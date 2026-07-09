// Paste this into the Apps Script editor bound to the recruitment Google
// Form (Extensions > Apps Script from within the Form), replace the two
// CONFIG values below, then add an "On form submit" trigger that calls
// onFormSubmit. See README.md in this folder for the full walkthrough.

var CONFIG = {
  BACKEND_URL: 'https://YOUR-BACKEND-DOMAIN/api/public/applicants/google-form',
  WEBHOOK_SECRET: 'PASTE_THE_SAME_VALUE_YOU_PUT_IN_GOOGLE_FORM_WEBHOOK_SECRET',
};

// Exact question titles from the form, mapped to the field names the
// backend expects. If you ever edit a question's title in the form, update
// the matching key here too.
var TITLE_TO_FIELD = {
  'FULL NAME': 'fullName',
  'WHATSAPP NUMBER': 'whatsappNumber',
  'MAIL ID': 'email',
  'INSTA ID (IF ANY, OTHERWISE WRITE NA)': 'instagramId',
  'EXPERIENCE IN YOUR FIELD ??': 'experienceLevel',
  'HAVE YOUR OWN LAPTOP ?': 'hasLaptop',
  'ARE YOU FROM RAIPUR. IF NOT, ARE YOU WILLING TO RELOCATE TO RAIPUR?': 'willingToRelocate',
  'WHICH POSITION ARE YOU APPLYING FOR?': 'positionAppliedFor',
  'WHEN CAN YOU START FROM?': 'availability',
  'HOW DID YOU FIND OUT ABOUT THIS POSITION?': 'howDidYouFindUs',
  'WHY DO YOU WANT TO WORK WITH OUR COMPANY?': 'whyJoinCompany',
  'DO YOU PREFER WORKING ALONE OR WITH A TEAM?': 'workStylePreference',
  'WHY SHOULD WE HIRE YOU?': 'whyHireYou',
  'WHAT IS YOUR CURRENT SALARY?': 'currentSalary',
  'WHAT IS YOUR EXPECTED SALARY?': 'expectedSalary',
};

function onFormSubmit(e) {
  var payload = {};
  var resumes = [];

  var itemResponses = e.response.getItemResponses();
  for (var i = 0; i < itemResponses.length; i++) {
    var item = itemResponses[i];
    var title = item.getItem().getTitle().trim();

    if (item.getItem().getType() === FormApp.ItemType.FILE_UPLOAD) {
      var fileIds = item.getResponse(); // array of Drive file ids
      for (var f = 0; f < fileIds.length; f++) {
        var file = DriveApp.getFileById(fileIds[f]);
        var blob = file.getBlob();
        resumes.push({
          filename: file.getName(),
          mimeType: blob.getContentType(),
          base64: Utilities.base64Encode(blob.getBytes()),
        });
      }
      continue;
    }

    var field = TITLE_TO_FIELD[title];
    if (field) {
      payload[field] = item.getResponse();
    }
  }

  payload.resumes = resumes;
  payload.googleFormResponseId = e.response.getId();

  var options = {
    method: 'post',
    contentType: 'application/json',
    payload: JSON.stringify(payload),
    headers: { 'X-Webhook-Secret': CONFIG.WEBHOOK_SECRET },
    muteHttpExceptions: true,
  };

  var response = UrlFetchApp.fetch(CONFIG.BACKEND_URL, options);
  Logger.log('Webhook response: ' + response.getResponseCode() + ' ' + response.getContentText());
}
