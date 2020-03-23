var CANDIDATE_SHEET = 'Candidate Tracker';
var SOCIAL_SHEET = 'Socials';
var PROF_SHEET = 'Professional Events';
var ONO_SHEET = 'One-On-Ones';
var GM_SHEET = 'GM Attendance';

/* Name Column on Candidate Sheet */
var NAME_COL = 2;

/* Format a candidate's information into JSON slack */
var NAME_INDEX = 1;
var TRACK_INDEX = 2;
var COMMITTEE_INDEX = 3;
var SOCIAL_COUNT = 7;
var SOCIAL_TOTAL = 10;
var PROF_COUNT = 8;
var PROF_TOTAL = 11;
var ONO_COUNT = 9;
var ONO_TOTAL = 12;
var GM1_REQ = 16;
var GM2_REQ = 17;
var GM3_REQ = 18;
var PAID_INDEX = 19;

/* Actions to execute */
var actions = {
  '/track' : {
    'execute': matchAllCandidates,
    'format' : matchCandidateText,
    'helpTxt' : [{'text': "Type `/track <candidate name>` to view a candidate's status"}],
    'error' : "No candidates found with given keywords",
  }
}

var ss = SpreadsheetApp.getActiveSpreadsheet();
var candSheet = ss.getSheetByName(CANDIDATE_SHEET);
var profSheet = ss.getSheetByName(PROF_SHEET);
var socialSheet = ss.getSheetByName(SOCIAL_SHEET);

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
        candidateList.push(sheet.getRange(i+2, 1, 1, sheet.getLastColumn()).getValues()[0]);
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
    var divider = {"type": "divider"};
    candidateText.push(divider);
  }
  var res = {
    "response_type": "ephemeral",
    "blocks": candidateText,
  }
  return res;
}
/* Find name in sheet */
function findName(name) { 
  var nameLst = candSheet.getRange(2, NAME_COL, candSheet.getLastRow(), 1).getValues();
  // Find the index of the given name
  for (var j = 0; j < nameLst.length; j+=1) {
    if (nameLst[j][0].toString() === name) {
      return j;
    }
  }
  throw "Name Not Found";
}

/* Finds all attended socials for given candidate */
function findSocials(name) { 
  var nameIndex = findName(name);
  
  var socialLst = [];
  var socialTitles = socialSheet.getRange(1, 1, 1, socialSheet.getLastColumn()).getValues()[0];
  var candidateSocials = socialSheet.getRange(nameIndex+2, 1, 1, socialSheet.getLastColumn()-1).getValues()[0];

  for (var j = 0; j < candidateSocials.length; j+=1) {
    if (candidateSocials[j] === 1) {
      socialLst.push(socialTitles[j]);
    }
  }
  
  return socialLst;
}

/* Finds all attended professional events for given candidate */
function findProf(name) {
  var nameIndex = findName(name);
  
  var profLst = [];
  var profTitles = profSheet.getRange(1, 1, 1, profSheet.getLastColumn()).getValues()[0];
  var candidateProf = profSheet.getRange(nameIndex+2, 1, 1, profSheet.getLastColumn()-1).getValues()[0];

  for (var j = 0; j < candidateProf.length; j+=1) {
    if (candidateProf[j] === 1) {
      profLst.push(profTitles[j]);
    }
  }
  
  return profLst;
}

function findONO(name) {
  var sheet = ss.getSheetByName(ONO_SHEET);
  
  var nameIndex = findName(name);
  
  var oneLst = [];
  
  var candidateONO = sheet.getRange(nameIndex+2, 5, 1, 10).getValues()[0];
  for (var j = 0; j < candidateONO.length-2; j+=2) {
    if (candidateONO[j] != "") {
      oneLst.push(candidateONO[j] + ' : ' +  candidateONO[j+1]);
    }
  }
  
  return oneLst;
}

/* Given lst of events, format them into bullet point string format */
function formatEvents(lst) {
  var str = "";
  for(var j = 0; j < lst.length; j++) {
    str += '\t- ' + lst[j] + '\n';
  }
  
  return str;
}

/* Formats each candidate info */
function formatCandidateInfo(candidate) {
  var ss = SpreadsheetApp.getActiveSpreadsheet(); 
  var sheet = ss.getSheetByName(CANDIDATE_SHEET);

  var socialsLst = formatEvents(findSocials(candidate[NAME_INDEX]));
  var profLst = formatEvents(findProf(candidate[NAME_INDEX]));
  var oneLst = formatEvents(findONO(candidate[NAME_INDEX]));
  
  var name = "*" + candidate[NAME_INDEX] + "*" + '\n';
  var committee = (candidate[TRACK_INDEX] === 'Committee' ? 'Committee: ' + candidate[COMMITTEE_INDEX] : candidate[TRACK_INDEX]) + '\n';
  var socials = '• *Socials*: ' + candidate[SOCIAL_COUNT] + ' / ' + candidate[SOCIAL_TOTAL] + '\n' + socialsLst;
  var prof = '• *Professional*: ' + candidate[PROF_COUNT] + ' / ' + candidate[PROF_TOTAL] + '\n' + profLst;
  var oneOnOne = '• *One-on-One*: ' + candidate[ONO_COUNT] + ' / ' + candidate[ONO_TOTAL] + '\n' + oneLst;
  
  var gm1 = '• *GM1 Requirements*: ' + (candidate[GM1_REQ] === 'YES' ? 'Yes' : '*NO*') + '\n';
  var gm2 = '• *GM2 Requirements*: ' + (candidate[GM2_REQ] === 'YES' ? 'Yes' : '*NO*') + '\n';
  var gm3 = '• *GM3 Requirements*: ' + (candidate[GM3_REQ] === 'YES' ? 'Yes' : '*NO*') + '\n';
  var paid = '• *Paid*: ' + (candidate[PAID_INDEX] ? "Yes" : "*No*") + '\n';
  
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


function process(req) {
  try {
    /* Retrieve response_url */
    url = req.response_url;
    
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
    var options = {
      'method' : 'post',
      'context-type' : 'application/json',
      'payload' : JSON.stringify(res),
    };
    UrlFetchApp.fetch(url, options);
  
  } catch(error) {
    Logger.log("New Error: " + error + ' from ' + e.postData.contents);
  
    var errorMsg = composeResponse(error, actions['/track'].helpTxt)
    var options = {
      'method' : 'post',
      'context-type' : 'application/json',
      'payload' : JSON.stringify(errorMsg),
    };
    UrlFetchApp.fetch(url, options);
  }
}

function processTrigger(event) {
  var functionArguments = handleTriggered(event.triggerUid);
  console.info("Function arguments: %s", functionArguments);
  process(functionArguments);
  deleteTriggerByUid(event.triggerUid);
}

function doPost(e) {
  var req = null;
  try {
    /* Convert slack request into JSON */
    req = e.parameter;
    
    var trigger = ScriptApp.newTrigger("processTrigger").timeBased().after(50).create();
    setupTriggerArguments(trigger, req, false); 
    
    /*
    var options = {
      'method' : 'post',
      'context-type' : 'application/json',
      'payload' : JSON.stringify(formData),
    };
    UrlFetchApp.fetch(url, options);
    */
    
    var tempRes = composeResponse("Thanks for your request, we'll process it and get back to you.");
    return response(tempRes);
  } catch(error) {
    Logger.log("New Error: " + error + ' from ' + e.postData.contents);
  
    var errorMsg = composeResponse(error, actions['/track'].helpTxt)
  
    return response(errorMsg);
  }
}

// https://stackoverflow.com/questions/32697653/how-can-i-pass-a-parameter-to-a-time-based-google-app-script-trigger
// https://stackoverflow.com/questions/52442261/doposte-how-to-immediately-response-http-200-ok-then-do-long-time-function

var RECURRING_KEY = "recurring";
var ARGUMENTS_KEY = "arguments";

/**
 * Sets up the arguments for the given trigger.
 *
 * @param {Trigger} trigger - The trigger for which the arguments are set up
 * @param {*} functionArguments - The arguments which should be stored for the function call
 * @param {boolean} recurring - Whether the trigger is recurring; if not the 
 *   arguments and the trigger are removed once it called the function
 */
function setupTriggerArguments(trigger, functionArguments, recurring) {
  var triggerUid = trigger.getUniqueId();
  var triggerData = {};
  triggerData[RECURRING_KEY] = recurring;
  triggerData[ARGUMENTS_KEY] = functionArguments;

  PropertiesService.getScriptProperties().setProperty(triggerUid, JSON.stringify(triggerData));
}

/**
 * Function which should be called when a trigger runs a function. Returns the stored arguments 
 * and deletes the properties entry and trigger if it is not recurring.
 *
 * @param {string} triggerUid - The trigger id
 * @return {*} - The arguments stored for this trigger
 */
function handleTriggered(triggerUid) {
  var scriptProperties = PropertiesService.getScriptProperties();
  var triggerData = JSON.parse(scriptProperties.getProperty(triggerUid));

  if (!triggerData[RECURRING_KEY]) {
    deleteTriggerByUid(triggerUid);
  }

  return triggerData[ARGUMENTS_KEY];
}

/**
 * Deletes trigger arguments of the trigger with the given id.
 *
 * @param {string} triggerUid - The trigger id
 */
function deleteTriggerArguments(triggerUid) {
  PropertiesService.getScriptProperties().deleteProperty(triggerUid);
}

/**
 * Deletes a trigger with the given id and its arguments.
 * When no project trigger with the id was found only an error is 
 * logged and the function continues trying to delete the arguments.
 * 
 * @param {string} triggerUid - The trigger id
 */
function deleteTriggerByUid(triggerUid) {
  if (!ScriptApp.getProjectTriggers().some(function (trigger) {
    if (trigger.getUniqueId() === triggerUid) {
      ScriptApp.deleteTrigger(trigger);
      return true;
    }

    return false;
  })) {
    console.error("Could not find trigger with id '%s'", triggerUid);
  }

  deleteTriggerArguments(triggerUid);
}

/**
 * Deletes a trigger and its arguments.
 * 
 * @param {Trigger} trigger - The trigger
 */
function deleteTrigger(trigger) {
  ScriptApp.deleteTrigger(trigger);
  deleteTriggerArguments(trigger.getUniqueId());
}