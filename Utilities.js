/**********************************************************************
 * PLTT Platform
 * Utilities.gs
 * Version: 0.4.3.0
 *
 * Release:
 * - Stable Authentication Baseline
 * - Shared utility functions for production authentication
 *
 * Status:
 * Authentication Complete
 **********************************************************************/

function getWorkbook() {
  return SpreadsheetApp.getActiveSpreadsheet();
}

function getSheet(sheetName) {

  const sheet = getWorkbook().getSheetByName(sheetName);

  if (!sheet) {
    throw new Error("Sheet not found: " + sheetName);
  }

  return sheet;

}

function getCurrentTimestamp() {

  return Utilities.formatDate(
    new Date(),
    APP.TIMEZONE,
    "yyyy-MM-dd HH:mm:ss"
  );

}

function successResponse(message, data) {

  return {
    success: true,
    message: message,
    data: data || null
  };

}

function errorResponse(message) {

  return {
    success: false,
    message: message
  };

}

function cleanPlayerCode(code) {
  return String(code).trim().toUpperCase();
}

function cleanMobile(number) {
  return String(number).replace(/\s+/g, "").trim();
}

function isValidPlayerCode(code) {
  return /^[A-Z0-9]{4,12}$/.test(cleanPlayerCode(code));
}

function isValidMobile(number) {
  return /^(\+44|0)[0-9]{10}$/.test(cleanMobile(number));
}

function generateNextId(sheetName,prefix){

  const sheet = getSheet(sheetName);
  const lastRow = sheet.getLastRow();

  if(lastRow<=1){
    return prefix + "0001";
  }

  const ids = sheet.getRange(2,1,lastRow-1,1).getValues().flat();

  let highest = 0;

  ids.forEach(function(id){
    const n = parseInt(String(id).replace(prefix,""),10);
    if(!isNaN(n) && n>highest){
      highest=n;
    }
  });

  return prefix + String(highest+1).padStart(4,"0");

}

function findRow(sheetName,column,value){

  const sheet = getSheet(sheetName);
  const lastRow = sheet.getLastRow();

  if(lastRow<=1){
    return -1;
  }

  const values = sheet.getRange(2,column,lastRow-1,1).getValues();

  for(let i=0;i<values.length;i++){
    if(String(values[i][0])===String(value)){
      return i+2;
    }
  }

  return -1;

}

function valueExists(sheetName,column,value){
  return findRow(sheetName,column,value)!==-1;
}

function logAction(feature,action,player,details){

  getSheet(SHEETS.LOGS).appendRow([
    getCurrentTimestamp(),
    feature,
    action,
    player,
    details
  ]);

}

function include(filename){
  return HtmlService.createHtmlOutputFromFile(filename).getContent();
}
