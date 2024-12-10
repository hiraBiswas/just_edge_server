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

// var admin = require("firebase-admin");

// var serviceAccount = require("./just-edge-firebase-adminsdk-4c6bb-01ad5b3eda.json");

// admin.initializeApp({
//   credential: admin.credential.cert(serviceAccount)
// });

async function run() {
  try {
    const userCollection = client.db("just_edge").collection("users");
    const studentsCollection = client.db("just_edge").collection("students");
    const coursesCollection = client.db("just_edge").collection("courses");
    const batchesCollection = client.db("just_edge").collection("batches");
    const instructorsCollection = client.db("just_edge").collection("instructors");
    const instructorsBatchesCollection = client.db("just_edge").collection("instructors-batches");
    const routineCollection = client.db("just_edge").collection("routine");
    

 
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
        const result = await studentsCollection.find().toArray();
        res.send(result);
      } catch (error) {
        console.error("Error fetching students:", error);
        res.status(500).send({ message: "Internal server error" });
      }
    });



// PATCH /students/:id
app.patch("/students/:id", async (req, res) => {
  const { id } = req.params; // Get the student ID from the URL parameter
  console.log(`Attempting to update student with ID: ${id}`);
  
  // Validate if the provided student ID is a valid ObjectId
  if (!isValidObjectId(id)) {
    return res.status(400).json({ error: "Invalid student ID format" });
  }

  try {
    const updateFields = { ...req.body }; // Extract fields to update from the request body

    // Check if `enrolled_batch` is being updated and validate its format
    if (updateFields.enrolled_batch) {
      if (!isValidObjectId(updateFields.enrolled_batch)) {
        return res.status(400).json({ error: "Invalid enrolled_batch ID format" });
      }
      // Convert to ObjectId if valid
      updateFields.enrolled_batch = new ObjectId(updateFields.enrolled_batch);
    }

    // Perform the update operation
    const result = await studentsCollection.updateOne(
      { _id: new ObjectId(id) }, // Filter by the student ID
      { $set: updateFields } // Update the specified fields
    );

    console.log("Update result:", result); // Log the update result

    if (result.modifiedCount === 1) {
      res.status(200).json({ message: "Student updated successfully" });
    } else {
      res.status(404).json({ message: "Student not found or no fields updated" });
    }
  } catch (error) {
    console.error("Error updating student:", error);
    res.status(500).json({ message: "Server error" });
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
    

    app.get("/courses", async (req, res) => {
      try {
        const result = await coursesCollection.find().toArray();
        console.log(result);  // Log to see what data is being returned
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


  

    app.post('/batches', async (req, res) => {
      const item = req.body;
  
    
      // Convert course_id to ObjectId if it's not already
      if (item.course_id && typeof item.course_id === 'string') {
        item.course_id = new ObjectId(item.course_id);
      }
    
      try {
        const result = await batchesCollection.insertOne(item);
        res.send(result);
      } catch (error) {
        console.error('Error saving batch:', error);
        res.status(500).send('Error saving batch');
      }
    });
    

    app.get('/batches/:id', async (req, res) => {
      const { id } = req.params; // Get the batch ID from the URL parameters
    
      // Ensure the provided ID is a valid MongoDB ObjectId
      if (!isValidObjectId(id)) {
        return res.status(400).json({ message: 'Invalid batch ID format' });
      }
    
      try {
        // Query the database for the batch by its ID
        const batch = await batchesCollection.findOne({ _id: new ObjectId(id) });
    
        if (!batch) {
          return res.status(404).json({ message: 'Batch not found' });
        }
    
        // Return the batch data as a JSON response
        res.json(batch);
      } catch (error) {
        console.error("Error fetching batch details:", error);
        res.status(500).json({ message: 'Error fetching batch details' });
      }
    });
    
    

    // Get all batches API
// app.get("/batches", async (req, res) => {
//   try {
//       const batches = await batchesCollection.find({ isDeleted: false }).toArray(); // Fetch batches that are not deleted
//       res.send(batches);
//   } catch (error) {
//       console.error("Error fetching batches:", error);
//       res.status(500).send({ message: "Internal server error" });
//   }
// });



app.get("/batches", async (req, res) => {
  try {
    // Step 1: Fetch batches and instructorIds (simplified version)
    const batches = await batchesCollection.aggregate([
      { $match: { isDeleted: false } },
      {
        $lookup: {
          from: "instructors-batches",
          localField: "_id",
          foreignField: "batchId",
          as: "batchInstructors",
        },
      },
      {
        $addFields: {
          instructorIds: { 
            $map: { input: "$batchInstructors", as: "batchInstructor", in: "$$batchInstructor.instructorId" },
          },
        },
      },
      {
        $project: { 
          _id: 1, 
          batchName: 1, 
          course_id: 1, 
          status: 1, 
          startDate: 1, 
          endDate: 1, 
          enrolledStudentNumber: 1,  // Make sure to include this
          instructorIds: 1, 
        },
      }
    ]).toArray();

    // Step 2: Fetch user details for the instructors
    const instructorIds = batches.flatMap(batch => batch.instructorIds);
    const users = await userCollection.find({ _id: { $in: instructorIds } }).toArray();

    // Step 3: Attach the user names (instructors) to the batches
    batches.forEach(batch => {
      batch.instructors = batch.instructorIds.map(id => {
        const user = users.find(user => user._id.toString() === id.toString());
        return user ? user.name : "Unassigned";
      });
    });

    // Return the batches with complete details
    res.send(batches); 
  } catch (error) {
    console.error("Error fetching batches:", error);
    res.status(500).send({ message: "Internal server error", error: error.message });
  }
});




// PATCH /batches/:id
app.patch("/batches/:id", async (req, res) => {
  const { id } = req.params;

   // Validate the batch ID format
  if (!isValidObjectId(id)) {
    return res.status(400).send({ error: "Invalid batch ID format" });
  }

  try {
    const updatedFields = req.body; // Fields to be updated (batchName, status, startDate, endDate, etc.)

    // Update the batch in the MongoDB collection
    const result = await batchesCollection.updateOne(
      { _id: new ObjectId(id) },
      { $set: updatedFields }
    );

    if (result.modifiedCount === 1) {
      res.status(200).send({ message: "Batch updated successfully" });
    } else {
      res.status(404).send({ message: "Batch not found or no fields updated" });
    }
  } catch (error) {
    console.error("Error updating batch:", error);
    res.status(500).send({ message: "Internal server error" });
  }
});


app.post('/instructors', async (req, res) => {
  const item = req.body;

  // Ensure the userId is converted to an ObjectId type
  if (item.userId) {
    item.userId = new ObjectId(item.userId);
  }

  const result = await instructorsCollection.insertOne(item);
  res.send(result);
});


app.get("/instructors", async (req, res) => {
  try {
    const result = await instructorsCollection.find().toArray();
    res.send(result);
  } catch (error) {
    console.error("Error fetching instructors:", error);
    res.status(500).send({ message: "Internal server error" });
  }
});


// Assign an instructor to a batch
app.post("/instructors-batches", async (req, res) => {
  const { instructorId, batchId } = req.body;

  if (!instructorId || !batchId) {
    return res.status(400).send({ error: "instructorId and batchId are required." });
  }

  if (!isValidObjectId(instructorId) || !isValidObjectId(batchId)) {
    return res.status(400).send({ error: "Invalid instructorId or batchId format." });
  }

  try {
    const existingRelation = await instructorsBatchesCollection.findOne({
      instructorId: new ObjectId(instructorId),
      batchId: new ObjectId(batchId),
    });

    if (existingRelation) {
      return res.status(409).send({ message: "This instructor is already assigned to the batch." });
    }
    

    const newRelation = {
      instructorId: new ObjectId(instructorId),
      batchId: new ObjectId(batchId),
      createdAt: new Date(),
    };

    const result = await instructorsBatchesCollection.insertOne(newRelation);

    res.status(201).send({
      message: "Relationship created successfully.",
      data: { id: result.insertedId },
    });
  } catch (error) {
    console.error("Error creating instructor-batch relationship:", error.message);
    res.status(500).send({ error: "Internal server error." });
  }
});

app.get("/instructors-batches", async (req, res) => {
  try {
    const result = await instructorsBatchesCollection.find().toArray();
    res.send(result);
  } catch (error) {
    console.error("Error fetching instructors:", error);
    res.status(500).send({ message: "Internal server error" });
  }
});

app.post("/routine", async (req, res) => {
  const { batchId, schedule } = req.body;
  console.log("Received batchId:", batchId);
  console.log("Received schedule:", schedule);

  // Validate input
  if (!batchId) {
    return res.status(400).json({ message: "BatchId is required" });
  }
  if (!schedule) {
    return res.status(400).json({ message: "Schedule is required" });
  }

  // Validate the batchId to make sure it's a valid MongoDB ObjectId
  if (!ObjectId.isValid(batchId)) {
    return res.status(400).json({ message: "Invalid batchId format" });
  }

  try {
    const newRoutine = {
      batchId: new ObjectId(batchId),
      schedule: schedule,
      createdAt: new Date(),
    };

    const result = await routineCollection.insertOne(newRoutine);
    
    return res.status(201).send({
      message: "Routine created successfully.",
      data: { id: result.insertedId },
    });
  } catch (error) {
    console.error("Error creating routine:", error.message);
    res.status(500).send({ error: "Internal server error." });
  }
});


app.get("/routine", async (req, res) => {
  try {
    const result = await routineCollection.find().toArray();
    res.send(result);
  } catch (error) {
    console.error("Error fetching routine:", error);
    res.status(500).send({ message: "Internal server error" });
  }
});


// Fetch routine by batchId
app.get("/routine/:batchId", async (req, res) => {
  const { batchId } = req.params;

  // Validate batchId
  if (!ObjectId.isValid(batchId)) {
    return res.status(400).json({ message: "Invalid batchId format" });
  }

  try {
    const routine = await routineCollection.findOne({ batchId: new ObjectId(batchId) });

    if (!routine) {

      return res.status(404).json({ message: "No routine found for this batch" });
    }
    console.log(routine);
    res.status(200).json(routine);
  } catch (error) {
    console.error("Error fetching routine:", error);
    res.status(500).json({ message: "Error fetching routine" });
  }
});


app.patch('/routine/:batchId', async (req, res) => {
  const { batchId } = req.params;  // Get batchId from the URL parameters
  const { schedule } = req.body;   // Get updated schedule from the request body

  console.log('Incoming PATCH Request for batchId:', batchId);
  console.log('Updated Schedule:', schedule);

  if (!ObjectId.isValid(batchId)) {
    return res.status(400).send({ error: "Invalid batch ID format" });
  }

  try {
    // Convert batchId to ObjectId before querying (use 'new' keyword)
    const existingRoutine = await routineCollection.findOne({ batchId: new ObjectId(batchId) });

    if (!existingRoutine) {
      // If routine with the batchId doesn't exist
      console.log(`Routine not found for batchId: ${batchId}`);
      return res.status(404).json({ message: 'Routine not found' });
    }

    // If routine exists, update the schedule
    const updateResult = await routineCollection.updateOne(
      { batchId: new ObjectId(batchId) }, // Use 'new ObjectId()' here
      { $set: { schedule } }  // Update the schedule field
    );

    if (updateResult.modifiedCount === 0) {
      // If no changes were made
      return res.status(400).json({ message: 'No changes were made to the routine.' });
    }

    // Fetch and send back the updated routine
    const updatedRoutine = await routineCollection.findOne({ batchId: new ObjectId(batchId) });
    res.status(200).json(updatedRoutine);
  } catch (error) {
    console.error('Error updating routine:', error);
    res.status(500).json({ message: 'Failed to update the routine', error: error.message });
  }
});
;




    await client.db("admin").command({ ping: 1 });
    console.log("Pinged your deployment. You successfully connected to MongoDB!");

  } finally {
    // await client.close();
  }
}

run().catch(console.dir);

app.get('/', (req, res) => {
  res.send('just_edge is connecting');
});

app.listen(port, () => {
  console.log(`justEdge is sitting on port ${port}`);
});