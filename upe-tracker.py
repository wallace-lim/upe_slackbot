"""
REQUIREMENTS
Have there's as environment variables
   export SLACK_VERIFICATION_TOKEN= <app verification token>
   export SLACK_TEAM_ID= <slack channel team id>
   export FLASK_APP= upe-tracker.py (not needed when using gunicorn on OCF)

To find slack variables,
1) Slack TEAM_ID = located in browser URL in workspace in the form T-------
2) Slack Verification Token = check app for verification token
"""

# Google Sheets Imports
import gspread
from oauth2client.service_account import ServiceAccountCredentials
import re

# Flask Imports
import requests
import os
from flask import abort, Flask, jsonify, request

# Zappa Imports
# from zappa.asynchronous import task

# Threading Imports
import threading

# Authorization
DIRNAME = os.path.dirname(__file__)
scope = ['https://spreadsheets.google.com/feeds', 'https://www.googleapis.com/auth/drive']
creds = ServiceAccountCredentials.from_json_keyfile_name(os.path.join(DIRNAME, 'client_creds.json'), scope)
client = gspread.authorize(creds)

# SpreadSheet
sheet = client.open('UPE Candidate Tracker (LIVE)')
# Sheet Names
candSheet = sheet.worksheet("Candidate Tracker")
socialSheet = sheet.worksheet('Socials')
profSheet = sheet.worksheet('Professional Events')
onoSheet = sheet.worksheet('One-On-Ones')

# Standand Google SpreadSheet Excel Column Locations
standardCol = {
    'email': 1,
    'name': 2,
    'track': 3,
    'committee': 4
}
# Candidate Tracker Sheet Column Values
candSheetCol = {
    'socials_complete': 8,
    'socials_reqs': 12,
    'prof_complete': 9,
    'prof_reqs': 13,
    'ono_complete': 10,
    'ono_reqs': 14,
    'gm1': 20,
    'gm2': 21,
    'gm3': 22,
    'paid': 23,
    'challenge': 25,
    'challenge_task': 26,
    'socials_ono_comp': 11, #DELETE THIS AFTER SP20 SEM
    'socials_ono_reqs': 15 #DELETE THIS AFTER SP20 SEM
}
maxCol = max(candSheetCol.values())

app = Flask(__name__)

# Possible actions
actions = {
    '/check' : {
        'helpTxt' : [{'text': "Type `/check <candidate name>` to view a candidate's status"}],
    }
}
"""
Checks whether provided action is a possible command
"""
def actionIsValid(action):
    return action in actions

"""
Checks whether payload matches correct verfication token and team ID
"""
def is_request_valid(request):
    is_token_valid = request.form['token'] == os.environ['SLACK_VERIFICATION_TOKEN']
    is_team_id_valid = request.form['team_id'] == os.environ['SLACK_TEAM_ID']

    return is_token_valid and is_team_id_valid

"""
Find the Google Sheet row of each name matching with expr
"""
def matchAllCandidates(expr):
    expr = expr.lower()
    nameIndices = []
    nameLst = candSheet.col_values(standardCol['name'])[1:]

    for i in range(len(nameLst)):
        # expr matches candidate name
        if re.search(expr, nameLst[i].lower()):
            nameIndices.append(i+2)

    return nameIndices

"""
Search for candidate given regex expr
@param expr - regex expression from typed comment `/check <expr>`
@return dictionary each candidate's info matching <expr>
Example dct[<candidate name>]
{
    'socials_complete': '1',
    'socials_reqs': '2',
    'prof_complete': '2',
    'prof_reqs': '2',
    'ono_complete': '2',
    'ono_reqs': '2',
    'socials': ['Big/Little Mixer 2/15'],
    'prof': ['Jane Street (2/26)']
    'gm1': YES,
    'gm2': YES,
    'gm3': NO,
    'paid': TRUE,
    'challenge': YES,
    'socialAndOno':
}
"""
def getMatchedCandidates(expr):
    def getCandidateEvents(sheetName, jump):
        # Labels of current sheet
        sheetLabels = sheetName.row_values(1)
        # Candidate Info on current sheet
        candSheet = sheetName.row_values(candRow)

        eventsVisited = []
        for eventIndex in range(4, len(sheetLabels)-2, jump):
            if candSheet[eventIndex] and jump == 2:
                eventsVisited.append("{type} : {name}".format(type=candSheet[eventIndex], name=candSheet[eventIndex+1]))
            elif candSheet[eventIndex]:
                eventsVisited.append(sheetLabels[eventIndex])

        return eventsVisited


    candidates = {}

    # Locate rows of candidates matching with name
    matchedLst = matchAllCandidates(expr)

    # Retrieve respective information for every candidate
    for candRow in matchedLst:
        # Grab Candidate Infomation in `Candidate Tracker` Sheet
        candidate = candSheet.row_values(candRow)

        candInfo = {}

        # Insert `Candidate Tracker` contents into dictionary
        for col, colNum in candSheetCol.items():
            if colNum - 1 > len(candidate):
                candInfo[col] = ""
            else:
                candInfo[col] = candidate[colNum-1]

        # Insert `Socials` contents into dictionary
        candInfo['socials'] = getCandidateEvents(socialSheet, 1)
        # Insert `Professional Events` contents into dictionary
        candInfo['prof'] = getCandidateEvents(profSheet, 1)
        # Insert `One-on-Ones` contents into dictionary
        candInfo['onos'] = getCandidateEvents(onoSheet, 2)


        candidates[candidate[standardCol['name'] - 1]] = candInfo

    return candidates

"""
Format each candidate in dictionary into Slack Markdown Format
@param dct - dictionary of matched candidate and their info
@return block - list of Slack text components
"""
def formatCandidateText(dct):
    block = []
    # Format each candidate into markdown format
    for name in dct.keys():
        # Grab candidate contents
        candInfo  = dct[name]

        nameTxt = '*{name}*\n'.format(name=name)

        # Socials
        socialsTxt = '• Socials: {pss}/{req}\n'.format(pss=candInfo['socials_complete'], req=candInfo['socials_reqs'])
        for social in candInfo['socials']:
            socialsTxt += '\t - {social}\n'.format(social=social)

        # Professional
        profTxt = '• Professional: {pss}/{req}\n'.format(pss=candInfo['prof_complete'], req=candInfo['prof_reqs'])
        for prof in candInfo['prof']:
            profTxt += '\t - {prof}\n'.format(prof=prof)

        # One-on-Ones
        onoTxt = '• One-on-One: {pss}/{req}\n'.format(pss=candInfo['ono_complete'], req=candInfo['ono_reqs'])
        for ono in candInfo['onos']:
            onoTxt += '\t - {ono}\n'.format(ono=ono)

        # Challenge
        challengeTxt = '• Challenge: {done}\n'.format(done='Done' if candInfo['challenge']=='YES' else '*NO*')
        if candInfo['challenge_task']:
            challengeTxt += '\t - {task}\n'.format(task=candInfo['challenge_task'])

        # General Meeting
        gm1 = '• GM1 Requirements: {done}\n'.format(done='Yes' if candInfo['gm1']=='YES' else '*NO*')
        gm2 = '• GM2 Requirements: {done}\n'.format(done='Yes' if candInfo['gm2']=='YES' else '*NO*')
        gm3 = '• GM3 Requirements: {done}\n'.format(done='Yes' if candInfo['gm3']=='YES' else '*NO*')
        paid = '• Paid: {done}\n'.format(done='Yes' if candInfo['paid']=='TRUE' else '*NO*')

        # --------------- REPLACE AFTER SP20 SEM -----------------
        # requirements = {
        #     'type':'section',
        #     'text': {
        #         'type': 'mrkdwn',
        #         'text': nameTxt + socialsTxt + profTxt + onoTxt + challengeTxt
        #     }
        # }

        # --------------- DELETE AFTER SP20 SEM -----------------
        socialOnoTxt = '• Socials / One-on-One: {pss}/{req}\n'.format(pss=candInfo['socials_ono_comp'], req=candInfo['socials_ono_reqs'])
        for social in candInfo['socials']:
            socialOnoTxt += '\t - {social}\n'.format(social=social)
        for ono in candInfo['onos']:
            socialOnoTxt += '\t - {ono}\n'.format(ono=ono)

        requirements = {
            'type':'section',
            'text': {
                'type': 'mrkdwn',
                'text': nameTxt + socialOnoTxt + profTxt + challengeTxt
            }
        }
        # --------------- END DELETE AFTER SP20 SEM -----------------

        attendance = {
            'type':'section',
            'text': {
                'type': 'mrkdwn',
                'text': gm1 + gm2 + gm3 + paid
            }
        }

        # Add comments together into array block (printed using Slack)
        block.append(requirements)
        block.append(attendance)

        # Push divider
        block.append({"type" : "divider"})

    return block

"""
POST Error message to Slack
"""
def error(msg, attachments, response_url):
    data = {
        "response_type": "ephemeral",
        "text": msg,
        "attachments": attachments
    }
    requests.post(response_url, json=data)

# DELETE `@TASK` IF NOT RUNNING ZAPPA (AWS LAMBDA)
"""
Runs bread and butter of code and POST back to slack
"""
# @task
def runGoogleSheets(req):
    response_url = req['response_url']

    # Check if argument len is sufficient
    if len(req['text']) < 3:
        error('Please submit an expression with more than two characters', actions['/check']['helpTxt'], req['response_url'])
        return

    # Retrieve candidate info according to text in Slack payload
    candidateInfos = getMatchedCandidates(req['text'])

    if len(candidateInfos) == 0:
        error('No candidates found with given keyword', actions['/check']['helpTxt'], req['response_url'])
        return

    # Format candidate info into Slack JSON format
    candidateFormatString = formatCandidateText(candidateInfos)

    data = {
        'response_type': 'ephemeral',
        'blocks' : candidateFormatString,
    }
    requests.post(response_url, json=data)

"""
POST request from Slack channel
Command: `/check <candidate name>`
"""
@app.route('/candidatetracker/check', methods=['POST'])
def track_candidates():

    # Check if valid request through (team_id) and (token)
    if not is_request_valid(request):
        abort(400)

    # Retrieve payload from Slack
    req = request.form

    # Check if possible command
    if not actionIsValid(req['command']):
        error('Please submit a valid command', actions['/check']['helpTxt'], req['response_url'])
        return

    # Login into client
    if creds.access_token_expired:
        client.login()

    # Create a thread to spawn find the correct values
    processThread = threading.Thread(
            target=runGoogleSheets,
            args=(req,)
        )
    processThread.start()

    # -- UNCOMMENT -- if not using threading
    # runGoogleSheets(req)

    # Send back a temporary loading response
    return jsonify(
        response_type='ephemeral',
        text='Loading your candidate data...',
    )


"""
GET request for testing
Command: `/check <candidate name>`
"""
@app.route('/candidatetracker/test', methods=['GET'])
def test():
    return jsonify( text='What\'s HKN?')

if __name__ == '__main__':
    app.run()
