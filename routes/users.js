var express = require("express");
var router = express.Router();
var _ = require("lodash");
var bcrypt = require("bcryptjs");
//User model
const User = require("./../models/userModel");
//Middleware to check if the user is logged in or not
const auth = require("./../utils/auth");
const { hashPassword } = require("./../utils/hash");
//Validation utils
const { regValidation, loginValidation } = require("./../utils/validation");
var AWS = require('aws-sdk')
const fs = require('fs')
const BUCKET = process.env.BUCKET;
const REGION = 'eu-west-1'
const ACCESS_KEY = process.env.AWS_ACCESS_KEY;
const SECRET_KEY = process.env.AWS_SECRET_KEY;

/*
  @POST /signUp
  @params : {username,email,password,password_confirm} as JSON 
*/
router.post("/signUp", async (req, res, next) => {
  let { firstname, lastname, username, email, password, password2 } = req.body;

  //validate the uesr
  const { error } = regValidation(req.body);
  if (error) {
    return res.status(400).json({ msg: error.details[0].message });
  }

  User.findOne({ username })
    .then(async (user) => {
      //If User found
      if (user) {
        if (user.email === email)
          return res.status(400).json({
            register: false,
            msg: `User with email ${email} and username ${username} already exists.`,
          });
        return res.status(400).send({
          register: false,
          msg: `User with username ${username} already exists!`,
        });
      } else {
        const newUser = new User({
          firstname,
          lastname,
          username,
          email,
          password,
        });
        const hash = await hashPassword(newUser.password);
        if (hash) {
          newUser.password = hash;
        }
        try {
          const token = await newUser.generateAuthToken();
          res.header("auth-token", token);
        } catch (err) {
          res.status(400).send(err);
        }

        return res.status(201).send({ register: true, user: newUser._id });
      }
    })
    .catch((err) => {
      return res.status(400).json({register:false,err});
    });
});

/* 
  @POST /signIn
  @params : {username,password} as JSON 
*/
router.post("/signIn", (req, res, next) => {
  let { username, password } = req.body;

  let { error } = loginValidation(req.body);
  if (error) {
    return res.status(400).send({ error: error.details[0].message });
  }

  User.findOne({ username }).then(async (user) => {
    if (!user) {
      return res
        .status(400)
        .json({ login: false, msg: `User not found! Check credentials.` });
    }

    const isPass = await bcrypt.compare(password, user.password);
    if (!isPass) {
      return res
        .status(400)
        .json({ login: false, msg: "Passwords do not match!" });
    }
    const token = await user.generateAuthToken();

    /*
     Send auth-token as a response header to your front-end.
    */
    res.header("auth-token", token);

    res.status(201).send({
      login: true,
      user: user["_id"],
      token,
    });
  });
});

/* 
  @GET /users
  @desc : List all stored users
  @access : Protected
*/
router.get("/users", auth, (req, res) => {
  User.find({}).then((users) => {
    res.status(200).json(users);
  });
});

/* 
  @GET /user/:id
  @params : user._id 
  @desc : Get a user with given "id"
  @access : Protected
*/
router.post("/user/:id", auth, (req, res) => {
  let { id } = req.params;
  User.findById({ _id: id })
    .then((user) => {
      if (user) {
        return res.json({ user: _.pick(user, ["_id", "username"]) });
      }
    })
    .catch(() => {
      res.status(400).json({ msg: "User not found" });
    });
});

/* 
  @GET /logout
  @params : JWT 'auth-token' as a request-header of a currently logged in session
  @access : Protected
*/
router.get("/logout", auth, async (req, res) => {
  try {
    req.user.tokens = req.user.tokens.filter((token) => {
      return token.token !== req.token;
    });

    await req.user.save();
    res.status(200).json({ logout: true });
  } catch (err) {}
});

/* 
  @GET /check
  @params : JWT 'auth-token' as a request-header of a currently logged in session
  @desc : Checks if the given token is valid or not
  @access : Protected
*/
router.get("/check", auth, async (req, res) => {
  let token = req.header("auth-token");
  if (!token) {
    return res.status(403).json({ msg: "Access denied" });
  }
  const user = await User.findOne({
    "tokens.token": token,
  });
  if (user) {
    return res.status(200).json({ user: true, id: user._id });
  } else {
    return res.status(403).json({ user: false });
  }
});

/*
  @PUT /update/:id
  @params:
    User ID to update its password
    { firstname, lastname, new_password, new_password_confirm } as JSON
  @desc: Updates password of user with _id:id
  @access: Protected
*/
router.put("/update/:id", (req, res, next) => {
  const { id } = req.params;
  const  { firstname, lastname, new_password, new_password_confirm } = req.body;
  if (new_password !== new_password_confirm) {
    return res
      .status(400)
      .send({ update: false, msg: "New password should match" });
  }
  User.findById({ _id: id })
    .then(async (user) => {
      if (user) {
        user.firstname = firstname ? firstname : user.firstname;
        user.lastname = lastname ? lastname : user.lastname;
        user.password = await hashPassword(new_password);
        await user.save();

        return res
          .status(200)
          .json({ update: true, msg: "Profile updated successfully" });
      }
    })
    .catch((err) => {
      res.status(400).json({ update: false, msg: "No user found" });
    });
});

/*
  @PUT /updateProfileImage/:id
  @params:
    { id, new_password_confirm } as JSON
  @desc: Updates password of user with _id:id
  @access: Protected
*/
router.put("/updateProfileImage/:id", (req, res, next) => {
  const { id } = req.params;
  const  { file } = req.body;
  if (file && id) {
    return res
      .status(400)
      .send({ update: false, msg: "Pleae send all details" });
  }
  const localImage = file;
  const imageRemoteName = `profileImage_${new Date().getTime()}.png`
  AWS.config.update({
    accessKeyId: ACCESS_KEY,
    secretAccessKey: SECRET_KEY,
    region: REGION
  })

  var s3 = new AWS.S3()

  s3.putObject({
    Bucket: BUCKET,
    Body: fs.readFileSync(localImage),
    Key: imageRemoteName
  })
    .promise()
    .then(response => {
      console.log(`done! - `, response)
      console.log(
        `The URL is ${s3.getSignedUrl('getObject', { Bucket: BUCKET, Key: imageRemoteName })}`
      )
      const profileImageUrl = s3.getSignedUrl('getObject', { Bucket: BUCKET, Key: imageRemoteName });
      User.findById({ _id: id })
      .then(async (user) => {
        if (user) {
          user.profileImage = profileImageUrl ? profileImageUrl : user.profileImage;
          await user.save();

          return res
            .status(200)
            .json({ update: true, msg: "Profile Picture updated successfully" });
        }
      })
      .catch((err) => {
        res.status(400).json({ update: false, msg: "No user found" });
      });
    })
    .catch(err => {
      console.log('failed:', err)
    })

 
});

module.exports = router;
