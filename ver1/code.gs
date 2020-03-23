var CANDIDATE_SHEET = 'Sheet1';
var NAME_COL = 1;

/* Format a ccandidate's information into JSON slack */
var NAME_INDEX = 0;
var TRACK_INDEX = 1;
var COMMITTEE_INDEX = 2;
var SOCIAL_COUNT = 3;
var SOCIAL_TOTAL = 6;
var PROF_COUNT = 4;
var PROF_TOTAL = 7;
var ONO_COUNT = 5;
var ONO_TOTAL = 8;
var GM1_REQ = 12;
var GM2_REQ = 13;
var GM3_REQ = 14;
var PAID_INDEX = 15;

var actions = {
  '/track' : {
    'execute': matchAllCandidates,
    'format' : matchCandidateText,
    'helpTxt' : [{'text': "Type `/track <candidate name>` to view a candidate's status"}],
    'error' : "No candidates found with given keywords",
  }
}

/* Check whether action is valid */
function actionisValid(action) {
  var actionList = Object.keys(actions);
  if (actionList.indexOf(action) > -1) return true;
  return false;
}

function composeResponse(text, attachments) {
  var res = {
    "response_type": "ephemeral",
    "text": text,
    "attachments": attachments || []
  };
  return res;
}

function response(res) {
  var resString = JSON.stringify(res);
  var JSONOutput = ContentService.createTextOutput(resString);
  JSONOutput.setMimeType(ContentService.MimeType.JSON);
  return JSONOutput;
}

/* Find all candidates matching str parameter */
function matchAllCandidates(str) {
  if (str.length < 2)
    throw 'Keyword needs to be of length 3 or greater';
  str = str.toLowerCase();
  
  var ss = SpreadsheetApp.getActiveSpreadsheet(); 
  var sheet = ss.getSheetByName(CANDIDATE_SHEET);
  
  var candidateNames = sheet.getRange(2, NAME_COL, sheet.getLastRow(), 1).getValues();
  var candidateList = [];
  // Retrieve all candidates that matches str
  for (var i = 0; i < candidateNames.length; i+=1) {
    if(candidateNames[i][0].toString().toLowerCase().indexOf(str) != -1) {
        candidateList.push(candidateInfo = sheet.getRange(i+2, 1, 1, sheet.getLastColumn()).getValues()[0]);
    }
  }
  return candidateList;
}

/* Create JSON Candidate Format */
function matchCandidateText(lst) {
  var candidateText = [];
  
  for (var i = 0 ; i < lst.length; i++) {
    var candidateInfo = formatCandidateInfo(lst[i]);
    for (var j = 0 ; j < candidateInfo.length; j++) {
      candidateText.push(candidateInfo[j]);
    }
    //if (i != lst.length - 1) {
      var divider = {"type": "divider"};
      candidateText.push(divider);
    //}
  }
  var res = {
    "response_type": "ephemeral",
    "blocks": candidateText,
  }
  return res;
}


function formatCandidateInfo(candidate) {
  var ss = SpreadsheetApp.getActiveSpreadsheet(); 
  var sheet = ss.getSheetByName(CANDIDATE_SHEET);
  
  var name = "*" + candidate[NAME_INDEX] + "*" + '\n';
  var committee = (candidate[TRACK_INDEX] === 'Committee' ? 'Committee: ' + candidate[COMMITTEE_INDEX] : candidate[TRACK_INDEX]) + '\n';
  var socials = '• Socials: ' + candidate[SOCIAL_COUNT] + ' / ' + candidate[SOCIAL_TOTAL] + '\n';
  var prof = '• Professional: ' + candidate[PROF_COUNT] + ' / ' + candidate[PROF_TOTAL] + '\n';
  var oneOnOne = '• One-on-One: ' + candidate[ONO_COUNT] + ' / ' + candidate[ONO_TOTAL] + '\n';
  
  var gm1 = '• GM1 Requirements: ' + (candidate[GM1_REQ] === 'YES' ? 'Yes' : '*NO*') + '\n';
  var gm2 = '• GM2 Requirements: ' + (candidate[GM2_REQ] === 'YES' ? 'Yes' : '*NO*') + '\n';
  var gm3 = '• GM3 Requirements: ' + (candidate[GM3_REQ] === 'YES' ? 'Yes' : '*NO*') + '\n';
  var paid = '• Paid: ' + (candidate[PAID_INDEX] ? "Yes" : "*No*") + '\n';
  
  var block = [
        {
			"type": "section",
			"text": {
				"type": "mrkdwn",
              "text": name + committee + socials + prof + oneOnOne
			}
		},
        {
			"type": "section",
			"text": {
				"type": "mrkdwn",
              "text": gm1 + gm2 + gm3 + paid
			}
		},
      ] 

  return block;
}

function doPost(e) {
  var req = null;
  try {
    /* Convert slack request into JSON */
    req = e.parameter;
    
    /* Retrieve action and args */ 
    var action = req['command'];
    var args = req['text'];
    if (!actionisValid(action))
      throw 'Invalid command: ' + action;
    
    /* Execute action */
    var resText = actions[action].execute(args);
    if (resText.length == 0)
      throw actions[action]['error'];
  
    /* Compose correct response */
    var res = actions[action].format(resText);
    
    /* Send response */
    return response(res);
    
  } catch(error) {
    Logger.log("New Error: " + error + ' from ' + e.postData.contents);
    
    var errorMsg = composeResponse(error, actions['/track'].helpTxt)
    
    return response(errorMsg);
  }
}

/* Deprecated Functions (used for only 1 individual) */
/*
function findCandidate(name) {
  var ss = SpreadsheetApp.getActiveSpreadsheet(); 
  var sheet = ss.getSheetByName(CANDIDATE_SHEET);
  
  var candidateNames = sheet.getRange(2, 1, sheet.getLastRow(), 1).getValues();
  
  // Find row with correct name
  var targetRow = null;
  for (var i = 0; i < candidateNames.length; i+=1) {
    if (candidateNames[i][0] === name) {
      targetRow = i + 2;
      break;
    }
  }
  // Retrieve Target Candidate Information
  var targetCandidate = sheet.getRange(targetRow, 1, 1, sheet.getLastColumn()).getValues()[0];
  return targetCandidate;
}

function formatCandidateText(candidate) {
  var ss = SpreadsheetApp.getActiveSpreadsheet(); 
  var sheet = ss.getSheetByName(CANDIDATE_SHEET);
  
  var name = "*" + candidate[0] + "*" + '\n';
  var committee = (candidate[1] === 'Committee' ? 'Committee: ' + candidate[2] : candidate[1]) + '\n';
  var socials = '• Socials: ' + candidate[3] + ' / ' + candidate[6] + '\n';
  var prof = '• Professional: ' + candidate[4] + ' / ' + candidate[7] + '\n';
  var oneOnOne = '• One-on-One: ' + candidate[5] + ' / ' + candidate[8] + '\n';
  
  var gm1 = '• GM1 Requirements: ' + (candidate[12] === 'YES' ? 'Yes' : '*NO*') + '\n';
  var gm2 = '• GM2 Requirements: ' + (candidate[13] === 'YES' ? 'Yes' : '*NO*') + '\n';
  var gm3 = '• GM3 Requirements: ' + (candidate[14] === 'YES' ? 'Yes' : '*NO*') + '\n';
  var paid = '• Paid: ' + (candidate[15] ? "Yes" : "*No*") + '\n';
  
  var res = {
    "response_type": "ephemeral",
    "blocks": [
        {
			"type": "section",
			"text": {
				"type": "mrkdwn",
              "text": name + committee + socials + prof + oneOnOne
			}
		},
        {
			"type": "section",
			"text": {
				"type": "mrkdwn",
              "text": gm1 + gm2 + gm3 + paid
			}
		},
      ] 
  };
  return res;
}
*/


