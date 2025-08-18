
## API Development Rules

### Routes Coding Rules
1. **All routes use POST method** - Consistent HTTP method for all endpoints
2. **Always use/return simplified JSON** - Keep response structures simple and consistent
3. **All routes return "return_code"** - Every response must include a machine-readable "return_code" field that is either "SUCCESS" or an error type
4. **Additional parameters allowed** - Routes can return any other parameters but must always include "return_code"
5. **Never change existing JSON fields** - If changes are needed to existing fields, create new variations to ensure backward compatibility with client app

### File Naming Rules
1. **Always use lowercase** - All new files must use lowercase filenames
2. **Use underscores** - Separate words with underscores (e.g., user_profile.js)
3. **Descriptive names** - File names should clearly indicate their purpose

## Documentation Standards

### Screen Documentation Rules
1. **Brief description required** - All screens must display a brief description at the top explaining what the screen does
2. **Purpose clarity** - Description should clearly state the screen's main function
3. **User context** - Explain what the user can accomplish on this screen

### API Route Documentation Rules
1. **Header format required** - All API route files must include a standardized header
2. **Complete specification** - Include method, purpose, request payload, success response, and return codes
3. **Standard format** - Use the following template:

### .env File Rules
1. **Use .env file** - Store all environment variables in a .env file
2. **Use environment variables** - Access environment variables using process.env.VARIABLE_NAME.
3. **Single env file** - Always only have one .env file and no others. No separate .env files for local or dev. Just a single .env file at project root

```
Use the below format for API routes
=======================================================================================================================================
API Route: [route_name]
=======================================================================================================================================
Method: POST
Purpose: [Clear description of what this route does]
=======================================================================================================================================
Request Payload:
{
  "field1": "value1",                  // type, required/optional
  "field2": "value2"                   // type, required/optional
}

Success Response:
{
  "return_code": "SUCCESS",
  "field1": "value1",                  // type, description
  "field2": "value2"                   // type, description
}
=======================================================================================================================================
Return Codes:
"SUCCESS"
"ERROR_TYPE_1"
"ERROR_TYPE_2"
"SERVER_ERROR"
=======================================================================================================================================
*/
```

## Code Quality Rules

### General Coding Standards
1. **Meaningful names** - Use descriptive variable and function names
2. **Error handling** - Implement comprehensive error handling for all operations
3. **Comments** - Add comments for complex logic and business rules
4. **Consistent formatting** - Follow established code formatting standards
5. **No hardcoded values** - Use configuration files or environment variables

### Database Rules
1. **Use parameterized queries** - Prevent SQL injection attacks
2. **Connection pooling** - Use connection pools for database connections
3. **Transaction management** - Use transactions for multi-step operations
4. **Index optimization** - Create appropriate indexes for query performance
5. **Data validation** - Validate all input data before database operations
6. **Connection** - Put all database connection details or template in .env file

### Security Rules
1. **Input validation** - Validate and sanitize all user inputs
2. **Rate limiting** - Implement rate limiting on all API endpoints
3. **CORS configuration** - Properly configure Cross-Origin Resource Sharing
4. **Password security** - Use bcrypt for password hashing
5. **Token expiration** - Implement appropriate token expiration times

### Frontend
1. Always use UI and widget code inline in the screen file itself
2. Do not centralise UI code with a single file
3. Each screen has its own UI design code

