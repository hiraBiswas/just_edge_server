const express = require("express");
const app = express();
const cors = require("cors");
const jwt = require("jsonwebtoken");
require("dotenv").config();
const port = process.env.PORT || 5000;

// middleware
app.use(cors());
app.use(express.json());

const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const uri = "mongodb+srv://just_edge:gFMaSV8z7Wg3TwGS@cluster0.eogwfq1.mongodb.net/?retryWrites=true&w=majority";

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

const isValidObjectId = (id) => /^[0-9a-fA-F]{24}$/.test(id);

async function run() {
  try {
    const userCollection = client.db("just_edge").collection("users");
    const studentCollection = client.db("just_edge").collection("students");
    const coursesCollection = client.db("just_edge").collection("courses");

    // JWT-related API
    app.post("/jwt", async (req, res) => {
      try {
        const user = req.body;
        const token = jwt.sign(user, process.env.ACCESS_TOKEN_SECRET, {
          expiresIn: "1h",
        });
        res.send({ token });
      } catch (error) {
        console.error("Error generating token:", error);
        res.status(500).send({ message: "Internal server error" });
      }
    });

    // JWT verification middleware
    const verifyToken = (req, res, next) => {
      const authHeader = req.headers.authorization;
      if (!authHeader || !authHeader.startsWith("Bearer ")) {
        return res.status(401).send({ message: "Unauthorized access" });
      }
      const token = authHeader.split(" ")[1];
      jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, decoded) => {
        if (err) {
          return res.status(401).send({ message: "Unauthorized access" });
        }
        req.decoded = decoded;
        next();
      });
    };

    // Verify Admin middleware
    const verifyAdmin = async (req, res, next) => {
      const email = req.decoded.email;
      const query = { email: email };
      const user = await userCollection.findOne(query);
      const isAdmin = user && user.type === "admin";
      if (!isAdmin) {
        return res.status(403).send({ message: "Forbidden access" });
      }
      next();
    };

    // Users API
    app.get("/users", verifyToken, verifyAdmin, async (req, res) => {
      const result = await userCollection.find().toArray();
      res.send(result);
    });

    app.get("/users/admin/:email", verifyToken, async (req, res) => {
      const email = req.params.email;
      if (email !== req.decoded.email) {
        return res.status(403).send({ message: "Forbidden access" });
      }
      const query = { email: email };
      const user = await userCollection.findOne(query);
      res.send({ admin: user?.type === "admin" });
    });

    app.post("/users", async (req, res) => {
      const user = req.body;
      const query = { email: user.email };
      const existingUser = await userCollection.findOne(query);
      if (existingUser) {
        return res.send({ message: "User already exists", insertedId: null });
      }
      const result = await userCollection.insertOne(user);
      res.send(result);
    });

    // Students API
    app.post("/students", async (req, res) => {
      const { userId, prefCourse, studentID, department, session, institution } = req.body;
      const studentData = {
        userId: new ObjectId(userId),          // Convert userId to ObjectId
        prefCourse: new ObjectId(prefCourse),  // Convert prefCourse to ObjectId
        studentID,
        department,
        session,
        institution,
        isDeleted: false,                      // Explicitly add isDeleted field
        batch_id: null                         // Add batch_id with a null value
      };
    
      try {
        const result = await studentCollection.insertOne(studentData);
        res.send(result);
      } catch (error) {
        console.error("Error creating student:", error);
        res.status(500).send({ message: "Internal server error" });
      }
    });
    

    // Get all students API
    app.get("/students", async (req, res) => {
      try {
        const result = await studentCollection.find().toArray();
        res.send(result);
      } catch (error) {
        console.error("Error fetching students:", error);
        res.status(500).send({ message: "Internal server error" });
      }
    });

    app.get("/students/:userId", async (req, res) => {
      const userId = req.params.userId;
      const query = { userId: new ObjectId(userId) };
      const student = await studentCollection.findOne(query);
      if (student) {
        res.send(student);
      } else {
        res.status(404).send({ message: "Student not found" });
      }
    });

    
    app.patch("/courses/:courseId", async (req, res) => {
      const { courseId } = req.params;
      console.log(`Attempting to update course with ID: ${courseId}`);
    
      if (!isValidObjectId(courseId)) {
        return res.status(400).send({ error: "Invalid course ID format" });
      }
    
      try {
        const result = await coursesCollection.updateOne(
          { _id: new ObjectId(courseId) },
          { $set: req.body }
        );
    
        console.log("Update result:", result); // Log the update result
    
        if (result.modifiedCount === 1) {
          res.status(200).send({ message: "Course updated successfully" });
        } else {
          res.status(404).send({ message: "Course not found or no fields updated" });
        }
      } catch (error) {
        console.error("Error updating course:", error);
        res.status(500).send({ message: "Server error" });
      }
    });
    


    // Courses API
    app.get("/courses", async (req, res) => {
      try {
        const result = await coursesCollection.find().toArray();
        res.send(result);
      } catch (error) {
        console.error("Error fetching courses:", error);
        res.status(500).send({ message: "Internal server error" });
      }
    });

    app.get("/courses/:id", async (req, res) => {
      const courseId = req.params.id;

      // Validate the ObjectId format
      if (!isValidObjectId(courseId)) {
        return res.status(400).send({ error: "Invalid course ID format" });
      }

      try {
        const course = await coursesCollection.findOne({
          _id: new ObjectId(courseId),
        });
        if (!course) {
          return res.status(404).send({ error: "Course not found" });
        }
        res.send(course); // Send back the course data
      } catch (error) {
        console.error("Error fetching course:", error);
        res.status(500).send({ error: "Internal Server Error" });
      }
    });



    // Create new course
    app.post('/courses',  async (req, res) => {
      const item = req.body;
      const result = await coursesCollection.insertOne(item);
      res.send(result);
    });



  } finally {
    // Uncomment the line below if you want to close the client after running
    // await client.close();
  }
}

run().catch(console.dir);

app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});
