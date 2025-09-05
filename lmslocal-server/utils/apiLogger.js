/*
=======================================================================================================================================
API Logger Utility
=======================================================================================================================================
Purpose: Logs API endpoint calls when check_API_call environment variable is set to YES
Usage: Call logApiCall('endpoint-name') at the start of any API route
=======================================================================================================================================
*/

const logApiCall = (endpointName) => {
  // Check if API call logging is enabled via environment variable
  if (process.env.CHECK_API_CALL === 'YES') {
    const timestamp = new Date().toLocaleString();
    console.log(`[API CALL] ${endpointName} - ${timestamp}`);
  }
};

module.exports = { logApiCall };