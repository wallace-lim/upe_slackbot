# Gspread Documentation: https://gspread.readthedocs.io/en/latest/index.html

# SHEET REQS
"""
Sheets: Candidate Tracker, Socials, Professional Events, One-On-Ones, GM Attendance
- All should have the same amount of rows of candidates (no difference)
"""

import gspread
from oauth2client.service_account import ServiceAccountCredentials
import pprint
import re

#Arguments
fake = 'Cindy'

# Debug Pretty Print Formatter
pp = pprint.PrettyPrinter()

# Authorization
scope = ['https://spreadsheets.google.com/feeds', 'https://www.googleapis.com/auth/drive']
creds = ServiceAccountCredentials.from_json_keyfile_name('client_creds.json', scope)
client = gspread.authorize(creds)

# SpreadSheet
sheet = client.open('UPE Candidate Tracker (LIVE)')
# Sheet Names
candSheet = sheet.worksheet("Candidate Tracker")
socialSheet = sheet.worksheet('Socials')
profSheet = sheet.worksheet('Professional Events')
onoSheet = sheet.worksheet('One-On-Ones')

# CANDIDATE TRACKER VALUES
standardCol = {
	'email': 1,
	'name': 2,
	'track': 3,
	'committee': 4
}
candSheetCol = {
    'socials_complete': 8,
    'socials_reqs': 11,
    'prof_complete': 9,
    'prof_reqs': 12,
    'ono_complete': 10,
    'ono_reqs': 13,
}



"""
Find the Google Sheet row of each name matching with expr
"""
def matchAllCandidates(expr):
	nameIndices = []
	nameLst = candSheet.col_values(standardCol['name'])[1:]

	for i in range(len(nameLst)):
		# expr matches candidate name
		if re.search(expr, nameLst[i]):
			nameIndices.append(i+2)

	return nameIndices


def getMatchedCandidates(expr):

	def getCandidateEvents(sheetName):
		# Labels of current sheet
		sheetLabels = sheetName.row_values(1)
		# Candidate Info on current sheet
		candSheet = sheetName.row_values(candRow)

		eventsVisited = []
		for eventIndex in range(4, len(sheetLabels)-2):
			if candSheet[eventIndex]:
				eventsVisited.append(sheetLabels[eventIndex])

		return eventsVisited


	candidates = {}

	# Locate rows of candidates matching with name
	matchedLst = matchAllCandidates(fake)

	# Retrieve respective information for every candidate
	for candRow in matchedLst:
		# Grab Candidate Infomation in `Candidate Tracker` Sheet
		candidate = candSheet.row_values(candRow)
		# Grab Candidate Infomation in `One-On-Ones` Sheet
		candOno = onoSheet.row_values(candRow)


		candInfo = {}

		# Insert `Candidate Tracker` contents into dictionary 
		for col, colNum in candSheetCol.items():
			candInfo[col] = candidate[colNum-1]

		# Insert `Socials` contents into dictionary
		candInfo['socials'] = getCandidateEvents(socialSheet)
		# Insert `Professional Events` contents into dictionary
		candInfo['prof'] = getCandidateEvents(profSheet)

		candidates[candidate[standardCol['name'] - 1]] = candInfo 
		
	return candidates


def main():
	# TODO: bounds check if text > 3

	# Retrieve Data for each matched candidate
	candidateInfos = getMatchedCandidates(fake)
	pp.pprint(candidateInfos)
	# Format candidate information into JSON
	

if __name__ == "__main__":
    main()