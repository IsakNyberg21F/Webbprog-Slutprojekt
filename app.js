const express = require("express");
const mysql = require("mysql2");
const dotenv = require("dotenv");
const path = require("path");
const bcrypt = require("bcrypt");
const session = require('express-session');
const multer = require("multer");
const flash = require('express-flash');
const { Console } = require("console");


// Multer storage configuration
const storage = multer.diskStorage({
  destination: "./public/uploads/",
  filename:(req, file, cb) => {
    return cb(null, `${file.fieldname}_${Date.now()}${path.extname(file.originalname)}`);
  }
});

const upload = multer({
  storage: storage
})






const app = express();

app.use(flash());


app.set("view engine", "hbs");
dotenv.config({ path: "./.env" });

// Konfigurera session middleware
app.use(session({
  secret: 'hemlighet',
  resave: true,
  saveUninitialized: true
}));

const publicDir = path.join(__dirname, "./public");

const db = mysql.createConnection({
  // .env hämtas värden från
  host: process.env.DATABASE_HOST,
  user: process.env.DATABASE_USER,
  password: process.env.DATABASE_PASSWORD,
  database: process.env.DATABASE,
});

app.use(express.urlencoded({ extended: false }));
app.use(express.json());

// Serve static files from the 'public' directory
app.use(express.static(publicDir));

db.connect((error) => {
  if (error) {
    console.log(error);
  } else {
    console.log("Ansluten till MySQL");
  }
});

app.get("/", (req, res) => {

  // Kontrollera om användaren är inloggad
  if (req.session.loggedIn) {
    // Fetch latest posts from database
    db.query("SELECT * FROM posts ORDER BY created_at DESC", (err, posts) => {
      if (err) {
        console.log(err);
        return res.status(500).send("Error fetching posts.");
      } else {
        res.render("index", { posts });
      }
    });
  } else {
    req.flash('error', 'You need to be logged in to view the feed.');
    res.redirect("/login"); // Annars omdirigera till login-sidan
  }
});

app.get("/profil", (req, res) => {
  if (req.session.loggedIn) {
    // Fetch posts
    db.query("SELECT * FROM posts WHERE account = ? ORDER BY created_at DESC", [req.session.username], (err, posts) => {
      if (err) {
        console.log(err);
        return res.status(500).send("Error fetching posts.");
      } else {
        // Fetch profile picture, bio, and username
        db.query("SELECT profile_picture, bio, name AS username FROM accounts WHERE name = ?", [req.session.username], (err, result) => {
          if (err) {
            console.log(err);
            return res.status(500).send("Error fetching profile data.");
          } else {
            const { profile_picture, bio, username } = result[0];
            console.log("Bio:", bio, "Profile picture:", profile_picture, "Username:", username);
            res.render("profil", { posts, profile_picture, bio, username });
          }
        });
      }
    });
  } else {
    req.flash('error', 'You need to be logged in to view your profile.');
    res.redirect("/login");
  }
});



//Använder mallen register.hbs
app.get("/register", (req, res) => {
  res.render("register");
});

//Använder mallen login.hbs
app.get("/login", (req, res) => {
  res.render("login", { message: req.flash('error') });
});

// Tar emot poster från registeringsformuläret
app.post("/auth/register", (req, res) => {
  const { name, email, password, password_confirm } = req.body;

  // regex för att kolla om lösenordet uppfyller kraven (hittad främst från internet)
  const passwordRegex =
    /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/;
  if (!password.match(passwordRegex)) {
    return res.render("register", {
      message:
        "Lösenordet måste vara minst 8 tecken långt och innehålla minst en stor bokstav, en liten bokstav, en siffra och ett specialtecken.",
    });
  }

  // kollar om lösenorden matchar -> annars meddelande att de inte gör det.
  if (password !== password_confirm) {
    return res.render("register", {
      message: "Lösenorden matchar inte",
    });
  }

  // query för att kolla om eposten&namn redan finns i databasen
  db.query(
    "SELECT * FROM accounts WHERE name = ? OR email = ?",
    [name, email],
    async (err, result) => {
      if (err) {
        console.log(err);
      } else {
        // Om det finns en matchning för användarnamnet eller e-postadressen, returnera felmeddelande
        if (result.length > 0) {
          return res.render("register", {
            message: "Användarnamnet eller e-postadressen finns redan.",
          });
        } else {
          try {
            // kryptera lösenordet
            const hashedPassword = await bcrypt.hash(password, 10);
            // lägg till användaren i databasen med det krypterade lösenordet
            db.query(
              "INSERT INTO accounts SET ?",
              { name: name, email: email, password: hashedPassword },
              (err, result) => {
                if (err) {
                  console.log(err);
                } else {
                  return res.render("register", {
                    message: "Användare registrerad",
                  });
                }
              }
            );
          } catch (error) {
            console.log(error);
            res.status(500).send("Något gick fel");
          }
        }
      }
    }
  );
});

app.post("/auth/login", (req, res) => {
  const { name, password } = req.body;

  db.query(
    "SELECT name, password, userid FROM accounts WHERE name = ?",
    [name],
    async (error, result) => {
      if (error) {
        console.log(error);
        req.flash('error', 'Something went wrong');
        return res.redirect("/login");
      }

      if (result.length === 0) {
        req.flash('error', 'User not found');
        return res.redirect("/login");
      }

      try {
        if (await bcrypt.compare(password, result[0].password)) {
          req.session.loggedIn = true; // Set loggedIn to true in session
          req.session.username = name; // Save username in session
          req.session.userId = result[0].userid; // Save user ID in session
          req.flash('success', 'Login successful');
          return res.redirect("/profil");
        } else {
          req.flash('error', 'Incorrect password');
          return res.redirect("/login");
        }
      } catch (error) {
        console.log(error);
        req.flash('error', 'Something went wrong');
        return res.redirect("/login");
      }
    }
  );
});



// Route för post-sidan

app.post("/post", (req, res) => {
  // Kontrollera om användaren är inloggad
  if (req.session.loggedIn) {
      res.redirect("/post"); // Omdirigera till post-sidan om inloggad
  } else {
      res.redirect("/login"); // Annars omdirigera till login-sidan
  }
});



app.get("/post", (req, res) => {
  res.render("post");
});



app.post("/auth/post", upload.single("image"), (req, res) => {
  const { caption, description } = req.body;
  const image = req.file;
  const account = req.session.username;
  db.query("SELECT profile_picture FROM accounts WHERE name = ?", [account], (err, result) => {
    if (err) {
      console.log(err);
      return res.status(500).send("Error fetching profile picture.");
    } else {
      const profile_picture = result[0].profile_picture;
      console.log("Received post data:", caption, description, image, account);

      if (!image) {
        return res.status(400).send("No file uploaded.");
      }

      // Handle image upload here (save to server and get the image path)
      const imagePath = `/uploads/${image.filename}`; // Use image.filename to get the file name
      const imagePathOnDisk = path.join(__dirname, "public", imagePath);

      // No need to move the uploaded file as it's already handled by Multer

      // Insert post details into the database
      db.query(
        "INSERT INTO posts (caption, description, image_path, account, profile_picture) VALUES (?, ?, ?, ?, ?)",
        [caption, description, imagePath, account, profile_picture],
        (err, result) => {
          if (err) {
            console.log(err);
            return res.render("post", { message: "Error posting." });
          } else {
            return res.redirect("/");
          }}
        );
      }
    }
  );
});





// Handle liking a post
app.post("/like", (req, res) => {
  if (!req.session.loggedIn) {
      return res.redirect("/login");
  }
  const postId = req.body.postId;
  const userId = req.session.userId; // Retrieve user ID from session
  console.log("User ID:", userId);

  // Check if the user is trying to like their own post
  db.query("SELECT account FROM posts WHERE id = ?", [postId], (err, result) => {
    if (err) {
          console.log(err);
          res.status(500).send("Error checking post owner.");
      } else if (result[0].account === req.session.username) {
          res.status(400).send("You can't like your own post.");
      } else {
        db.query("SELECT * FROM post_reactions WHERE post_id = ? AND user_id = ? AND reaction = 'like'", [postId, userId], (err, rows) => {
          if (err) {
              console.log(err);
              res.status(500).send("Error checking post reaction.");
          }
          else if (rows.length > 0) {
            // User has already liked the post
            db.query("DELETE FROM post_reactions WHERE post_id = ? AND user_id = ? AND reaction = 'like'", [postId, userId], (err, result) => {
                if (err) {
                    console.log(err);
                    res.status(500).send("Error removing like.");
                } else {
                    db.query("UPDATE posts SET likes = likes - 1 WHERE id = ?", [postId], (err, result) => {
                          if (err) {
                              console.log(err);
                              res.status(500).send("Error updating post likes.");
                          } else {
                              res.redirect("/");
                          }
                      });
                  }
              });
          } else {
              // Insert the user's like reaction into the post_reactions table
              db.query("INSERT INTO post_reactions (post_id, user_id, reaction) VALUES (?, ?, 'like')", [postId, userId], (err, result) => {
                  if (err) {
                      console.log(err);
                      res.status(500).send("Error liking post. Must remove dislike first.");
                  } else {
                      // Increment the likes count in the posts table
                      db.query("UPDATE posts SET likes = likes + 1 WHERE id = ?", [postId], (err, result) => {
                          if (err) {
                              console.log(err);
                              res.status(500).send("Error updating post likes.");
                          } else {
                              res.redirect("/");
                          }
                      });
                  }
              });
          }
      });
    }
  })
});

// Handle disliking a post
app.post("/dislike", (req, res) => {
  if (!req.session.loggedIn) {
    return res.redirect("/login");
  }
  const postId = req.body.postId;
  const userId = req.session.userId; // Retrieve user ID from session

  // Check if the user is trying to dislike their own post
  db.query("SELECT account FROM posts WHERE id = ?", [postId], (err, result) => {
    if (err) {
      console.log(err);
      res.status(500).send("Error checking post owner.");
    } else if (result[0].account === req.session.username) {
      res.status(400).send("You can't dislike your own post.");
    } else {
      // Check if the user has already disliked the post
      db.query("SELECT * FROM post_reactions WHERE post_id = ? AND user_id = ? AND reaction = 'dislike'", [postId, userId], (err, rows, ) => {
        if (err) {
          console.log(err);
          res.status(500).send("Error checking post reaction.");
        } else if (rows.length > 0) {
          // User has already disliked the post
          db.query("DELETE FROM post_reactions WHERE post_id = ? AND user_id = ? AND reaction = 'dislike'", [postId, userId], (err, result) => {
            if (err) {
              console.log(err);
              res.status(500).send("Error removing dislike.");
            } else {
              db.query("UPDATE posts SET dislikes = dislikes - 1 WHERE id = ?", [postId], (err, result) => {
                if (err) {
                  console.log(err);
                  res.status(500).send("Error updating post dislikes.");
                } else {
                  res.redirect("/");
                }
              });
            }
          });
        } else {
          // Insert the user's dislike reaction into the post_reactions table
          db.query("INSERT INTO post_reactions (post_id, user_id, reaction) VALUES (?, ?, 'dislike')", [postId, userId], (err, result) => {
            if (err) {
              console.log(err);
              res.status(500).send("Error disliking post. Must remove like first.");
            } else {
              // Increment the dislikes count in the posts table
              db.query("UPDATE posts SET dislikes = dislikes + 1 WHERE id = ?", [postId], (err, result) => {
                if (err) {
                  console.log(err);
                  res.status(500).send("Error updating post dislikes.");
                } else {
                  res.redirect("/");
                }
              });
            }
          });
        }
      });
    }
  });
});





app.post("/delete", (req, res) => {
  if (!req.session.loggedIn) {
    return res.redirect("/login");
  }
  const postId = req.body.postId;
  const account = req.session.username;

  db.query("DELETE FROM comments WHERE post_id = ?", [postId], (err, result) => {
    if (err) {
      console.log(err);
      res.status(500).send("Error deleting comments.");
    } else {
      // Delete post
      db.query("DELETE FROM posts WHERE id = ? AND account = ?", [postId, account], (err, result) => {
        if (err) {
          console.log(err);
          res.status(500).send("Error deleting post.");
        } else {
          res.redirect("/");
        }
      });
    }
  });
});

app.get("/comment", (req, res) => {
  if (!req.session.loggedIn) {
    return res.redirect("/login");
  }
  const postId = req.query.postId;
  db.query("SELECT account, caption, description, image_path, created_at, id FROM posts WHERE id = ?", [postId], (err, posts) => {
    if (err) {
      console.log(err);
      res.status(500).send("Error fetching post.");
    } else {
      db.query("SELECT account, comment, created_at FROM comments WHERE post_id = ?", [postId], (err, comments) => {
        if (err) {
          console.log(err);
          res.status(500).send("Error fetching comments.");
        } else {
          db.query("SELECT profile_picture FROM accounts WHERE name = ?", [req.session.username], (err, result) => {
            if (err) {
              console.log(err);
              res.status(500).send("Error fetching profile picture.");
            } else {
              const profile_picture = result[0].profile_picture;
              res.render("comment", { posts, comments, profile_picture });
            }
          });
        }
      });
    }
  });
});

app.post("/comment", (req, res) => {
  if (!req.session.loggedIn) {
    return res.redirect("/login");
  }
  const { postId, comment } = req.body;
  const account = req.session.username;
  const date = new Date();
  console.log("Received comment data:", postId, comment, account, date);

  db.query("INSERT INTO comments (post_id, account, comment, created_at) VALUES (?, ?, ?, ?)", [postId, account, comment, date], (err, result) => {
    if (err) {
      console.log(err);
      res.status(500).send("Error commenting.");
    } else {
      // Dont redirect to /comment, just do nothing
      res.redirect("/comment?postId=" + postId);
    }
  });
});









app.post("/change_profile", upload.single("image"), (req, res) => {
  const account = req.session.username;
  const image = req.file;
  const username = req.body.username;
  const bio = req.body.bio;
  console.log("Received profile data:", image, username, bio, account);

  if (!image) {
    return res.status(400).send("No file uploaded.");
  }

  const imagePath = `/uploads/${image.filename}`;
  const imagePathOnDisk = path.join(__dirname, "public", imagePath);

  db.query(
    "UPDATE accounts SET profile_picture = ?, bio = ?, name = ? WHERE name = ?",
    [imagePath, bio, username, account],
    (err, result) => {
      if (err) {
        console.log(err);
        return res.render("profil", { message: "Error updating profile." });
      } else {
        db.query("UPDATE posts SET profile_picture = ? WHERE account = ?", [imagePath, username], (err, result) => {
          if (err) {
            console.log(err);
            return res.render("profil", { message: "Error updating profile picture in posts." });
          } else {
            req.session.username = username;
            res.redirect("/profil");
          }
        });
      }
    }
  );
});






app.get("/logout", (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      console.log(err);
      res.status(500).send("Error logging out");
    } else {
      res.redirect("/login");
    }
  });
});




// Körde på 4000 här för porten istället för 3000
// från server.js vi tidigare kört
app.listen(4000, () => {
  console.log("Servern körs, besök http://localhost:4000");
});