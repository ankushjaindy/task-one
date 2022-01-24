# SimiFrom Task


# How to use
	1. Download the repository
	2. Open project in your favourite IDE.
	3. Fill all ENV variables then run npm install.
	4. Start MongoDB service in your machine
	5. Change the connection string of DB in ENV.
	5. Start the app by running npm run dev and open POSTMAN.
	6. Start with POST /signUp and rest is all yours.


# Routes
1. POST Routes
	1. /signUp <br/>
		Accepts ```{firstname, lastname, username,email,password,password_confirm}``` and returns user ID on successful registration. 
	
  	2. /signIn <br/>
		Accepts ```{username,password}``` and returns JWT "Auth-Token" which can be used for subsequent requests to protected routes
		
  	3. /user/:id <br/>
		Returns a user with given ```{id}``` as a URL parameter
	
2. GET routes
  	1. /users <br/>
	  	List all stored users from DB

  	2. /logout <br/>
	  	Logs user out from current session

3. PUT routes
  	1. /update/:id <br/>
	  Update password and other fields (or any other details you want) of the user with given id

	2. /updateProfileImage/:id <br/>
	  Update profile image (or any other details you want) of the user with given id
