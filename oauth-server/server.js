const express = require('express');
const session = require('express-session');
const bodyParser = require('body-parser');
const path = require('path');

const app = express();
app.use(express.static(path.join(__dirname, 'public')));
app.use(bodyParser.urlencoded({ extended: false }));
app.use(session({ secret: 'disk-analyzer-secret', resave: false, saveUninitialized: true }));

const users = {};

// Landing page
app.get('/', (req, res) => {
  if (req.session.username) {
    res.redirect('/dashboard');
  } else {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
  }
});

// Sign up
app.post('/signup', (req, res) => {
  const { username, password } = req.body;
  if (users[username]) {
    return res.send('<script>alert("User already exists");window.location="/"</script>');
  }
  users[username] = { password };
  req.session.username = username;
  res.redirect('/dashboard');
});

// Sign in
app.post('/signin', (req, res) => {
  const { username, password } = req.body;
  if (!users[username] || users[username].password !== password) {
    return res.send('<script>alert("Invalid credentials");window.location="/"</script>');
  }
  req.session.username = username;
  res.redirect('/dashboard');
});

// Dashboard
app.get('/dashboard', (req, res) => {
  if (!req.session.username) return res.redirect('/');
  res.send(`<h2>Welcome, ${req.session.username}!</h2><a href="/logout">Logout</a>`);
});

// Logout
app.get('/logout', (req, res) => {
  req.session.destroy(() => res.redirect('/'));
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`OAuth server running at http://localhost:${PORT}`));
