
 Frontend GitHub:
 https://github.com/cdileep23/paftoXml-client
 
 Backend Setup

Steps to Set Up the Backend Project

1. Clone the Repository
   Open a terminal and run the following command to clone the repository:
   ```sh
   git clone https://github.com/cdileep23/pdfToXml-server.git
   ```

2. Navigate to the Project Directory
   Change into the project directory:
   ```sh
   cd pdfToXml-server
   ```

3. Install Dependencies
   Install the necessary packages using npm:
   ```sh
   npm install
   ```

4. Run the Backend Server
   Start the server with the following command:
   ```sh
   npm start
   ```

5. API Access
   Once the server is running, it will be available at:
   ```
   http://localhost:4545
   ```
   Ensure the backend is running properly before accessing the frontend.


## Models

### User Model
The `User` model stores user details and authentication information.
```json
{
  "_id": "string",
  "email": "string",
  "password": "string",
  "name": "string",
  "photoUrl": "string",
  "createdAt": "Date"
}
```

### Conversion Model
The `Conversion` model tracks PDF to XML conversions.
```json
{
  "_id": "string",
  "userId": "string",
  "pdfLink": "string",
  "xmlContent": "string",
  "createdAt": "Date",
  "originalFileName": "string",
  "pdfPages": "number"
}
```

## API Endpoints

### User APIs
- Login
  Request:
  ```json
  {
    "email": "user@example.com",
    "password": "password123"
  }
  ```
  Response:
  ```json
  {
    "token": "jwt-token",
    "user": {
      "_id": "string",
      "email": "string",
      "name": "string",
      "photoUrl": "string"
    }
  }
  ```
  Endpoint: `POST /user/login`

- Register
  Request:
  ```json
  {
    "name": "John Doe",
    "email": "user@example.com",
    "password": "password123"
  }
  ```
  Response:
  ```json
  {
    "message": "User registered successfully"
  }
  ```
  Endpoint: `POST /user/register`

- Logout 
  **Endpoint:*`GET /user/logout`

- Get Profile
  **Endpoint:** `GET /user/profile`

- Update Profile
  Endpoint: `PUT /user/profile`

### Conversion APIs
- Create Conversion  
 
  Endpoint: `POST /conversion/create-conversion`

- Get All Conversions  
  Endpoint: `GET /conversion/all-conversion`

- Get Specific Conversion  
  Endpoint: `GET /conversion/get-conversion/:conversionId`

- Delete Conversion  
  Endpoint: `GET /conversion/delete-conversion/:conversionId`



