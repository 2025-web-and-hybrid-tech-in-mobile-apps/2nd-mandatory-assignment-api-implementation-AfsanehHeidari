const express = require('express');
const passport = require('passport');
const jwt = require('jsonwebtoken');
const { Strategy, ExtractJwt } = require('passport-jwt');

const app = express();
const port = process.env.PORT || 3000;

// Body parser middleware to parse JSON requests
app.use(express.json());

const users = [
  {
    id: 1,
    userHandle: 'johnDoe',
    password: 'password123',  // In a real app, use hashed passwords
  },
];

const highscores = [];

const JWT_SECRET = 'your_jwt_secret_key';

const jwtOptions = {
  jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
  secretOrKey: JWT_SECRET,
};

passport.use(
  new Strategy(jwtOptions, (payload, done) => {
    const user = users.find((user) => user.id === payload.id);
    if (user) {
      return done(null, user);
    } else {
      return done(null, false);
    }
  })
);

app.use(passport.initialize());

// /signup route
app.post('/signup', (req, res) => {
  const { userHandle, password } = req.body;
  if (!userHandle || !password) {
    return res.status(400).json({ message: 'UserHandle and password are required.' });
  }
  if (userHandle.length < 6) {
    return res.status(400).json({ message: 'UserHandle must be at least 6 characters long.' });
  }

  if (password.length < 6) {
    return res.status(400).json({ message: 'Password must be at least 6 characters long.' });
  }

  const newUser = { id: users.length + 1, userHandle, password };
  users.push(newUser);

  const payload = { id: newUser.id, userHandle: newUser.userHandle };
  const token = jwt.sign(payload, JWT_SECRET, { expiresIn: '1h' });

  res.status(201).json({ message: 'User created successfully', token });
});

// /login route
app.post('/login', (req, res) => {
  const { userHandle, password , ...extraFields } = req.body;

  // Check if both userHandle and password are provided
  if (!userHandle || !password) {
    return res.status(400).json({ message: 'UserHandle and password are required.' });
  }
 
  // Validate that the userHandle and password are strings
  if (typeof userHandle !== 'string' || typeof password !== 'string') {
    return res.status(400).json({ message: 'Both userHandle and password must be strings.' });
  }
  // Check for unexpected additional fields
  if (Object.keys(extraFields).length > 0) {
    return res.status(400).json({ message: 'data must NOT have additional properties' });
  }


  const user = users.find((u) => u.userHandle === userHandle && u.password === password);

  // If the user is not found or credentials are incorrect
  if (!user) {
    return res.status(401).json({ message: 'Invalid credentials' });
  }

  // Generate JWT token after successful login
  const payload = { id: user.id, userHandle: user.userHandle };
  const token = jwt.sign(payload, JWT_SECRET, { expiresIn: '1h' });

  return res.json({ jsonWebToken: token });
});


// /high-scores route to post highscore
app.post('/high-scores', passport.authenticate('jwt', { session: false }), (req, res) => {
  console.log('Received request at /hiscore'); // Add this for debugging
  console.log('Request body:', req.body); // Log the body of the request
  const { level, userHandle, score, timestamp } = req.body;

  // Check for required fields
  if (!level || !userHandle || !score || !timestamp) {
    return res.status(400).json({ message: "Missing required fields" });
  }

  // Create the highscore entry
  const highscore = { level, userHandle, score, timestamp };
  highscores.push(highscore);

  // Respond with success
  return res.status(201).json({ message: 'Highscore created successfully', highscore });
});

// Error handling middleware to catch passport errors
app.use((err, req, res, next) => {
  if (err.name === 'JsonWebTokenError') {
    return res.status(401).json({ message: 'Invalid or expired JWT token' });
  } 
  if (err.name === 'UnauthorizedError') {
    return res.status(401).json({ message: 'JWT token missing or invalid' });
  }
  next(err);
});


// /high-scores route to get highscores for a specific level
app.get('/high-scores', (req, res) => {
  const { level } = req.query;
  const { page = 1, perPage = 20 } = req.query;  // Default page = 1 and perPage = 10

  console.log(`Requested level: ${level}`);  // Debugging log
  console.log(`Highscores: ${JSON.stringify(highscores)}`);  // Debugging log
  
  if (!level) {
    return res.status(400).json({ message: 'Level is required' });
  }
  // Corrected filtering logic
const levelHighscores = highscores.filter((score) =>score.level === level);


if (levelHighscores.length === 0) {
  return res.status(200).json([]); // Return an empty array if no highscores found
}



  // Sort the highscores in descending order of score
  levelHighscores.sort((a, b) => b.score - a.score);
  
  // Pagination logic
  const startIndex = (page - 1) * perPage;
  const endIndex = page * perPage;
  const paginatedScores = levelHighscores.slice(startIndex, endIndex);

  return res.status(200).json(paginatedScores);
});

// Export the app instance for testing
function start() {
  app.listen(port, () => {
    console.log(`Server is running on http://localhost:${port}`);
  });
}

function close() {
  app.close();
}

let serverInstance = null;
module.exports = {
  start: function () {
    serverInstance = app.listen(port, () => {
      console.log(`Example app listening at http://localhost:${port}`);
    });
  },
  close: function () {
    serverInstance.close();
  },
};
if (require.main === module) {
  module.exports.start();
}
