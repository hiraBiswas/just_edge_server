const express = require("express");
const app = express();
const cors = require("cors");
const jwt = require("jsonwebtoken");
const multer = require("multer");
const upload = multer({ storage: multer.memoryStorage() });
require("dotenv").config();
const port = process.env.PORT || 5000;
const bcrypt = require("bcryptjs");
// middleware
app.use(cors());
app.use(express.json());

const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const uri =
  "mongodb+srv://hira190112:190112@cluster0.eogwfq1.mongodb.net/?retryWrites=true&w=majority";

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
    const studentsCollection = client.db("just_edge").collection("students");
    const coursesCollection = client.db("just_edge").collection("courses");
    const batchesCollection = client.db("just_edge").collection("batches");
    const instructorsCollection = client
      .db("just_edge")
      .collection("instructors");
    const instructorsBatchesCollection = client
      .db("just_edge")
      .collection("instructors-batches");
    const routineCollection = client.db("just_edge").collection("routine");
    const onlineProfileCollection = client
      .db("just_edge")
      .collection("online-profile");
    const classesCollection = client.db("just_edge").collection("classes");
    const resultCollection = client.db("just_edge").collection("result");
    const noticeCollection = client.db("just_edge").collection("notice");
    const batchChangeRequestCollection = client.db("just_edge").collection("batch_change_request");

    // JWT-related API
    app.post("/jwt", async (req, res) => {
      try {
        const user = req.body;
        const token = jwt.sign(user, process.env.ACCESS_TOKEN_SECRET, {
          expiresIn: "5min",
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
    app.get("/users", async (req, res) => {
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

    app.get("/users/instructor/:email", async (req, res) => {
      const { email } = req.params;

      try {
        const user = await userCollection.findOne({ email });

        if (!user) {
          return res.status(404).json({ isInstructor: false });
        }

        return res.json({
          isInstructor: user.type === "instructor",
        });
      } catch (error) {
        console.error("Error checking if user is an instructor:", error);
        return res.status(500).json({
          isInstructor: false,
          message: "Internal server error",
        });
      }
    });

    // app.post("/users", async (req, res) => {
    //   const user = req.body;

    //   // Check if the user already exists
    //   const query = { email: user.email };
    //   const existingUser = await userCollection.findOne(query);
    //   if (existingUser) {
    //     return res.send({ message: "User already exists", insertedId: null });
    //   }

    //   try {
    //     // Hash the password before saving it
    //     const hashedPassword = await bcrypt.hash(user.password, 10); // 10 is the salt rounds

    //     // Store the user object with the hashed password
    //     const userWithHashedPassword = {
    //       ...user,
    //       password: hashedPassword
    //     };

    //     const result = await userCollection.insertOne(userWithHashedPassword);

    //     res.send(result);
    //   } catch (error) {
    //     console.error("Error hashing password:", error);
    //     res.status(500).send({ message: "Server error" });
    //   }
    // });

    // students API

    app.post("/users", async (req, res) => {
      const user = req.body;

      // Validate input
      if (!user.email || !user.password || !user.name) {
        return res.status(400).send({
          success: false,
          message: "Missing required fields",
        });
      }

      // Validate email format
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(user.email)) {
        return res.status(400).send({
          success: false,
          message: "Invalid email format",
        });
      }

      const query = { email: user.email };

      try {
        const existingUser = await userCollection.findOne(query);
        if (existingUser) {
          return res.status(400).send({
            success: false,
            message: "User with this email already exists",
          });
        }

        const hashedPassword = await bcrypt.hash(user.password, 10);

        const userWithHashedPassword = {
          ...user,
          password: hashedPassword,
          createdAt: new Date(),
        };

        const result = await userCollection.insertOne(userWithHashedPassword);

        if (result.insertedId) {
          res.status(201).send({
            success: true,
            insertedId: result.insertedId,
            message: "User registered successfully",
          });
        } else {
          res.status(500).send({
            success: false,
            message: "Error registering user",
          });
        }
      } catch (error) {
        console.error("Error while registering user:", error);
        res.status(500).send({
          success: false,
          message: "Server error during registration",
        });
      }
    });

    app.post("/students", async (req, res) => {
      const {
        userId,
        prefCourse,
        studentID,
        department,
        session,
        institution,
      } = req.body;

      console.log("Received data:", req.body); // Log the incoming data

      const studentData = {
        userId: new ObjectId(userId), // Convert userId to ObjectId
        prefCourse: new ObjectId(prefCourse), // Convert prefCourse to ObjectId
        studentID,
        department,
        session,
        institution,
        isDeleted: false, // Explicitly add isDeleted field
        enrolled_batch: null, // Add batch_id with a null value
      };

      try {
        const result = await studentsCollection.insertOne(studentData);
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

    app.post("/onlineProfile", async (req, res) => {
      const { studentId, github, linkedin, upwork } = req.body;

      // Convert studentId to ObjectId if it's not already an ObjectId
      let studentObjectId;
      try {
        studentObjectId = new ObjectId(studentId); // Convert to ObjectId if necessary
      } catch (err) {
        return res.status(400).send("Invalid studentId");
      }

      try {
        // Insert or update the profile with the student's ID and provided links
        const result = await onlineProfileCollection.updateOne(
          { studentId: studentObjectId }, // Check if the studentId exists
          {
            $set: { github, linkedin, upwork }, // Update the online profiles
          },
          { upsert: true } // If profile doesn't exist, create it
        );

        if (result.modifiedCount > 0 || result.upsertedCount > 0) {
          res.status(200).send("Profile updated successfully");
        } else {
          res.status(400).send("No changes made");
        }
      } catch (err) {
        console.error("Error updating profile:", err);
        res.status(500).send("Error updating profile");
      }
    });

    app.get("/onlineProfile", async (req, res) => {
      try {
        const result = await onlineProfileCollection.find().toArray();
        res.send(result);
      } catch (error) {
        console.error("Error fetching courses:", error);
        res.status(500).send({ message: "Internal server error" });
      }
    });

    app.get("/onlineProfile/:studentId", async (req, res) => {
      const { studentId } = req.params; // Extract studentId from the URL

      try {
        // Convert studentId from string to ObjectId
        if (!ObjectId.isValid(studentId)) {
          return res.status(400).json({
            success: false,
            message: "Invalid student ID format",
          });
        }

        // Query for the profile using ObjectId
        const profile = await onlineProfileCollection.findOne({
          studentId: new ObjectId(studentId), // Convert to ObjectId when querying
        });

        if (!profile) {
          return res.status(404).json({
            success: false,
            message: "Profile not found for the given student ID",
          });
        }

        res.status(200).json({
          success: true,
          message: "Profile fetched successfully",
          data: profile,
        });
      } catch (error) {
        console.error("Error fetching profile:", error);
        res.status(500).json({
          success: false,
          message: "Failed to fetch profile",
          error: error.message,
        });
      }
    });

    app.patch("/onlineProfile/:studentId", async (req, res) => {
      const { studentId } = req.params; // Get studentId from params
      const updates = req.body; // Get update data from request body

      try {
        // Ensure the studentId is a valid ObjectId
        if (!ObjectId.isValid(studentId)) {
          return res.status(400).json({
            success: false,
            message: "Invalid student ID format",
          });
        }

        // Perform the update
        const updatedProfile = await onlineProfileCollection.findOneAndUpdate(
          { studentId: new ObjectId(studentId) }, // Convert studentId to ObjectId
          { $set: updates }, // Apply updates
          { returnDocument: "after" } // Return the updated document
        );

        // Check if a profile was found and updated
        if (!updatedProfile) {
          return res.status(404).json({
            success: false,
            message: "Profile not found for the given student ID",
          });
        }

        res.status(200).json({
          success: true,
          message: "Profile updated successfully",
          data: updatedProfile.value, // Updated document
        });
      } catch (error) {
        console.error("Error updating profile:", error);
        res.status(500).json({
          success: false,
          message: "Update failed",
          error: error.message,
        });
      }
    });

    // PATCH /students/:id
    // app.patch("/students/:id", async (req, res) => {
    //   const { id } = req.params; // Get the student ID from the URL parameter
    //   console.log(`Attempting to update student with ID: ${id}`);

    //   // Validate if the provided student ID is a valid ObjectId
    //   if (!isValidObjectId(id)) {
    //     return res.status(400).json({ error: "Invalid student ID format" });
    //   }

    //   try {
    //     const updateFields = { ...req.body }; // Extract fields to update from the request body

    //     // Check if `enrolled_batch` is being updated and validate its format
    //     if (updateFields.enrolled_batch) {
    //       if (!isValidObjectId(updateFields.enrolled_batch)) {
    //         return res
    //           .status(400)
    //           .json({ error: "Invalid enrolled_batch ID format" });
    //       }
    //       // Convert to ObjectId if valid
    //       updateFields.enrolled_batch = new ObjectId(
    //         updateFields.enrolled_batch
    //       );
    //     }

    //     // Perform the update operation
    //     const result = await studentsCollection.updateOne(
    //       { _id: new ObjectId(id) }, // Filter by the student ID
    //       { $set: updateFields } // Update the specified fields
    //     );

    //     console.log("Update result:", result); // Log the update result

    //     if (result.modifiedCount === 1) {
    //       res.status(200).json({ message: "Student updated successfully" });
    //     } else {
    //       res
    //         .status(404)
    //         .json({ message: "Student not found or no fields updated" });
    //     }
    //   } catch (error) {
    //     console.error("Error updating student:", error);
    //     res.status(500).json({ message: "Server error" });
    //   }
    // });

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
            return res
              .status(400)
              .json({ error: "Invalid enrolled_batch ID format" });
          }
          // Convert to ObjectId if valid
          updateFields.enrolled_batch = new ObjectId(
            updateFields.enrolled_batch
          );
        }

        // Handle the file fields (ensure these files are being handled properly)
        if (updateFields.passportPhoto) {
          // Handle passport photo file update logic (e.g., save the file to a directory and store the filename in the DB)
        }
        if (updateFields.nidFront) {
          // Handle NID Front file update logic
        }
        if (updateFields.nidBack) {
          // Handle NID Back file update logic
        }

        // Perform the update operation (only update the fields that are provided)
        const result = await studentsCollection.updateOne(
          { _id: new ObjectId(id) }, // Filter by the student ID
          { $set: updateFields } // Update the specified fields
        );

        console.log("Update result:", result); // Log the update result

        // Check if the student was updated successfully
        if (result.modifiedCount === 1) {
          res.status(200).json({ message: "Student updated successfully" });
        } else {
          res
            .status(404)
            .json({ message: "Student not found or no fields updated" });
        }
      } catch (error) {
        console.error("Error updating student:", error);
        res.status(500).json({ message: "Server error" });
      }
    });

    // Login API to authenticate the user and generate a JWT token
    app.post("/login", async (req, res) => {
      const { email, password } = req.body;

      try {
        // Find user by email
        const user = await userCollection.findOne({ email });

        // If no user found, return an error
        if (!user) {
          return res
            .status(400)
            .send({ message: "Email or password is not correct" });
        }

        // Compare the provided password with the stored hashed password
        const isPasswordValid = await bcrypt.compare(password, user.password);

        if (!isPasswordValid) {
          return res
            .status(401)
            .send({ message: "Email or password is not correct" });
        }

        // Generate JWT token
        const token = jwt.sign(
          { email: user.email, userId: user._id, type: user.type },
          process.env.ACCESS_TOKEN_SECRET,
          { expiresIn: "1h" } // Token expiration time (can be adjusted)
        );

        // Send the token back to the client
        res.send({ token, user });
      } catch (error) {
        console.error("Error during login:", error);
        res.status(500).send({ message: "Internal server error" });
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
          res
            .status(404)
            .send({ message: "Course not found or no fields updated" });
        }
      } catch (error) {
        console.error("Error updating course:", error);
        res.status(500).send({ message: "Server error" });
      }
    });

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
    app.post("/courses", async (req, res) => {
      const item = req.body;
      const result = await coursesCollection.insertOne(item);
      res.send(result);
    });

    app.post("/batches", async (req, res) => {
      try {
        const batchData = req.body;
        console.log("Raw request body:", req.body);
        console.log("Received batch data:", batchData);

        // Validate required fields
        const requiredFields = ["course_id", "batchNumber", "seat"];
        const missingFields = requiredFields.filter(
          (field) => !batchData[field]
        );

        if (missingFields.length > 0) {
          return res.status(400).json({
            error: "Missing required fields",
            missingFields: missingFields,
          });
        }

        const newBatch = {
          course_id: new ObjectId(batchData.course_id),
          batchNumber: batchData.batchNumber, 
          batchName: batchData.batchName || `${batchData.courseName} - ${batchData.batchNumber}`,
          startDate: batchData.startDate ? new Date(batchData.startDate) : null,
          endDate: batchData.endDate ? new Date(batchData.endDate) : null,
          seat: parseInt(batchData.seat) || 0,
          status: batchData.status || "Upcoming",
          isDeleted: batchData.isDeleted !== undefined ? batchData.isDeleted : false,
          occupiedSeat: parseInt(batchData.occupiedSeat) || 0,
          createdAt: new Date(),
          instructorIds: [],
          instructors: [],
        };
        
        console.log("Final batch object to insert:", newBatch);

        // Insert into database
        const result = await batchesCollection.insertOne(newBatch);

        if (result.insertedId) {
          // Return the complete saved document
          const savedBatch = await batchesCollection.findOne({
            _id: result.insertedId,
          });
          res.status(201).json({
            message: "Batch created successfully",
            batch: savedBatch,
          });
        } else {
          res.status(500).json({ error: "Failed to create batch" });
        }
      } catch (error) {
        console.error("Error creating batch:", error);
        res.status(500).json({
          error: "Failed to create batch",
          details: error.message,
        });
      }
    });

 

    app.get("/next-batch-number/:courseId", async (req, res) => {
      try {
        const courseId = req.params.courseId;
             
        if (!courseId) {
          return res.status(400).json({ error: "Course ID is required" });
        }
        
        // Convert string courseId to ObjectId for proper MongoDB comparison
        const objectIdCourseId = new ObjectId(courseId);
          
        // Get all batches for this course with the corrected query
        const batches = await batchesCollection
          .find({ course_id: objectIdCourseId })
          .toArray();
          
        // Rest of your code remains the same
        const batchNumbers = batches.map(batch => parseInt(batch.batchNumber, 10));
        const maxBatchNumber = batchNumbers.length > 0 
          ? Math.max(...batchNumbers)
          : 0;
        const nextBatchNumber = (maxBatchNumber + 1)
          .toString()
          .padStart(3, '0');
          
        console.log(`Current max batch number: ${maxBatchNumber}`);
        console.log(`Generated next batch number: ${nextBatchNumber}`);
          
        res.json({ nextBatchNumber });
      } catch (error) {
        console.error("Error generating batch number:", error);
        res.status(500).json({
          error: "Failed to generate batch number",
          details: error.message
        });
      }
    });
    

    app.get("/batches/:id", async (req, res) => {
      const { id } = req.params;

      // Validate MongoDB ObjectId
      if (!ObjectId.isValid(id)) {
        return res.status(400).json({ message: "Invalid batch ID format" });
      }

      try {
        // Fetch the batch by ID
        const batch = await batchesCollection.findOne({
          _id: new ObjectId(id),
        });

        if (!batch) {
          return res.status(404).json({ message: "Batch not found" });
        }

        // Fetch instructor IDs for this batch
        const batchInstructors = await instructorsBatchesCollection
          .find({ batchId: new ObjectId(id) })
          .toArray();

        const instructorIds = batchInstructors.map(
          (instructor) => instructor.instructorId
        );

        // Fetch user details for the instructors
        const instructors = await userCollection
          .find({ _id: { $in: instructorIds } })
          .toArray();

        // Attach instructor names to the batch
        batch.instructors = instructors.map(
          (user) => user.name || "Unassigned"
        );

        // Include instructor IDs as well if needed
        batch.instructorIds = instructorIds;

        // Return the batch with instructor details
        return res.json(batch);
      } catch (error) {
        console.error("Error fetching batch details:", error);
        return res
          .status(500)
          .json({ message: "Error fetching batch details" });
      }
    });

    app.get("/batches", async (req, res) => {
      try {
        // Fetch batches and instructor IDs
        const batches = await batchesCollection
          .aggregate([
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
                  $map: {
                    input: "$batchInstructors",
                    as: "batchInstructor",
                    in: { $toObjectId: "$$batchInstructor.instructorId" }, // ✅ ObjectId conversion
                  },
                },
              },
            },
            {
              $project: {
                _id: 1,
                batchName: 1,
                batchNumber:1,
                course_id: 1,
                status: 1,
                startDate: 1,
                endDate: 1,
                seat: 1,
                occupiedSeat: 1,
                instructorIds: 1,
                isDeleted: 1,
                createdAt: 1,
              },
            },
          ])
          .toArray();

        console.log("Fetched Batches:", batches.length); // ✅ Debugging Log

        // Extract unique instructor IDs
        const instructorIds = batches
          .flatMap((batch) => batch.instructorIds)
          .filter((id) => id);

        console.log("Instructor IDs:", instructorIds); // ✅ Debugging Log

        const instructors = await instructorsCollection
          .find({ _id: { $in: instructorIds } })
          .toArray();

        const userIds = instructors.map(
          (instructor) => new ObjectId(instructor.userId)
        );

        const users = await userCollection
          .find({ _id: { $in: userIds } })
          .toArray();

        // Map batches with instructor names
        batches.forEach((batch) => {
          batch.instructors = batch.instructorIds.map((instructorId) => {
            const instructor = instructors.find((inst) =>
              inst._id.equals(instructorId)
            );

            if (instructor) {
              const user = users.find((user) =>
                user._id.equals(instructor.userId)
              );

              if (user) {
                return user.name;
              } else {
                console.log(`No User found for Instructor ID: ${instructorId}`);
              }
            } else {
              console.log(`No Instructor found for ID: ${instructorId}`);
            }

            return "Unassigned";
          });
        });

        res.send(batches);
      } catch (error) {
        console.error("Error fetching batches:", error);
        res
          .status(500)
          .send({ message: "Internal server error", error: error.message });
      }
    });

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
          res
            .status(404)
            .send({ message: "Batch not found or no fields updated" });
        }
      } catch (error) {
        console.error("Error updating batch:", error);
        res.status(500).send({ message: "Internal server error" });
      }
    });

    app.post("/instructors", async (req, res) => {
      const { userId, contact, isDeleted } = req.body;

      // Comprehensive validation
      if (!userId) {
        return res.status(400).json({
          success: false,
          message: "User ID is required",
        });
      }

      if (!contact) {
        return res.status(400).json({
          success: false,
          message: "Contact information is required",
        });
      }

      try {
        // Verify user exists
        const user = await userCollection.findOne({
          _id: new ObjectId(userId),
        });
        if (!user) {
          return res.status(404).json({
            success: false,
            message: "Associated user not found",
          });
        }

        // Check if instructor already exists
        const existingInstructor = await instructorsCollection.findOne({
          userId: new ObjectId(userId),
        });
        if (existingInstructor) {
          return res.status(400).json({
            success: false,
            message: "Instructor already registered",
          });
        }

        const instructorData = {
          userId: new ObjectId(userId),
          contact,
          status: "Pending",
          isDeleted: false,
          createdAt: new Date(),
        };

        const result = await instructorsCollection.insertOne(instructorData);

        if (result.insertedId) {
          return res.status(201).json({
            success: true,
            message: "Instructor registered successfully",
            insertedId: result.insertedId,
          });
        } else {
          return res.status(500).json({
            success: false,
            message: "Error registering instructor",
          });
        }
      } catch (error) {
        console.error("Error while registering instructor:", error);
        return res.status(500).json({
          success: false,
          message: "Server error while registering instructor",
        });
      }
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

    app.get("/instructors/:id", async (req, res) => {
      const { id } = req.params;

      // Validate the ID
      if (!ObjectId.isValid(id)) {
        return res.status(400).json({ message: "Invalid instructor ID." });
      }

      try {
        // Find the instructor by _id
        const instructor = await instructorsCollection.findOne({
          _id: new ObjectId(id),
          isDeleted: false, // Ensure the instructor is not deleted
        });

        // Check if the instructor exists
        if (!instructor) {
          return res.status(404).json({ message: "Instructor not found." });
        }

        // Send the instructor data
        return res.status(200).json(instructor);
      } catch (error) {
        console.error("Error fetching instructor:", error);
        return res.status(500).json({ message: "Error fetching instructor." });
      }
    });

    app.patch("/instructors/:instructorId", async (req, res) => {
      console.log("PATCH request received for:", req.params.instructorId);

      const { instructorId } = req.params;
      const updateFields = req.body; // Get all fields to update from the request body

      if (!ObjectId.isValid(instructorId)) {
        return res.status(400).json({ message: "Invalid instructor ID." });
      }

      // Ensure at least one field is provided for update
      if (!updateFields || Object.keys(updateFields).length === 0) {
        return res
          .status(400)
          .json({ message: "No fields provided for update." });
      }

      try {
        // Find the instructor first to check existence
        const instructor = await instructorsCollection.findOne({
          _id: new ObjectId(instructorId),
        });

        if (!instructor) {
          return res.status(404).json({ message: "Instructor not found." });
        }

        // Proceed to update the instructor
        const result = await instructorsCollection.findOneAndUpdate(
          { _id: new ObjectId(instructorId) },
          { $set: updateFields },
          { returnDocument: "after" }
        );

        // Send back the updated instructor data
        res.status(200).json({
          success: true,
          message: "Instructor updated successfully",
          instructor: result.value,
        });
      } catch (error) {
        console.error("Error updating instructor:", error);
        res.status(500).json({
          success: false,
          message: "Error updating instructor.",
        });
      }
    });

    // Assign an instructor to a batch
    app.post("/instructors-batches", async (req, res) => {
      const { instructorId, batchId } = req.body;

      if (!instructorId || !batchId) {
        return res
          .status(400)
          .send({ error: "instructorId and batchId are required." });
      }

      if (!isValidObjectId(instructorId) || !isValidObjectId(batchId)) {
        return res
          .status(400)
          .send({ error: "Invalid instructorId or batchId format." });
      }

      try {
        const existingRelation = await instructorsBatchesCollection.findOne({
          instructorId: new ObjectId(instructorId),
          batchId: new ObjectId(batchId),
        });

        if (existingRelation) {
          return res.status(409).send({
            message: "This instructor is already assigned to the batch.",
          });
        }

        const newRelation = {
          instructorId: new ObjectId(instructorId),
          batchId: new ObjectId(batchId),
          createdAt: new Date(),
        };

        const result = await instructorsBatchesCollection.insertOne(
          newRelation
        );

        res.status(201).send({
          message: "Relationship created successfully.",
          data: { id: result.insertedId },
        });
      } catch (error) {
        console.error(
          "Error creating instructor-batch relationship:",
          error.message
        );
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

    // app.post("/routine", async (req, res) => {
    //   const { batchId, schedule } = req.body;
    //   console.log("Received batchId:", batchId);
    //   console.log("Received schedule:", schedule);

    //   // Validate input
    //   if (!batchId) {
    //     return res.status(400).json({ message: "BatchId is required" });
    //   }
    //   if (!schedule) {
    //     return res.status(400).json({ message: "Schedule is required" });
    //   }

    //   // Validate the batchId to make sure it's a valid MongoDB ObjectId
    //   if (!ObjectId.isValid(batchId)) {
    //     return res.status(400).json({ message: "Invalid batchId format" });
    //   }

    //   try {
    //     const newRoutine = {
    //       batchId: new ObjectId(batchId),
    //       schedule: schedule,
    //       createdAt: new Date(),
    //     };

    //     const result = await routineCollection.insertOne(newRoutine);

    //     return res.status(201).send({
    //       message: "Routine created successfully.",
    //       data: { id: result.insertedId },
    //     });
    //   } catch (error) {
    //     console.error("Error creating routine:", error.message);
    //     res.status(500).send({ error: "Internal server error." });
    //   }
    // });

    app.post("/routine", async (req, res) => {
      const { batchId, day, startTime, endTime } = req.body;

      // Validate input
      if (!batchId) {
        return res.status(400).json({ message: "BatchId is required" });
      }
      if (!day || !startTime || !endTime) {
        return res
          .status(400)
          .json({ message: "Day, startTime, and endTime are required" });
      }

      // Validate the batchId to make sure it's a valid MongoDB ObjectId
      if (!ObjectId.isValid(batchId)) {
        return res.status(400).json({ message: "Invalid batchId format" });
      }

      try {
        const newRoutine = {
          batchId: new ObjectId(batchId),
          day,
          startTime,
          endTime,
          createdAt: new Date(),
        };

        const result = await routineCollection.insertOne(newRoutine);

        return res.status(201).send({
          message: "Routine entry created successfully.",
          data: { id: result.insertedId },
        });
      } catch (error) {
        console.error("Error creating routine:", error.message);
        res.status(500).send({ error: "Internal server error." });
      }
    });

    app.get("/routine", async (req, res) => {
      const { batchId } = req.query;

      try {
        // Validate batchId
        if (!batchId) {
          return res.status(400).json({ message: "BatchId is required" });
        }

        // Ensure batchId is a valid ObjectId
        if (!ObjectId.isValid(batchId)) {
          return res.status(400).json({ message: "Invalid batchId format" });
        }

        // Find routines for the specific batch
        const routines = await routineCollection
          .find({ batchId: new ObjectId(batchId) })
          .toArray();

        return res.status(200).json(routines);
      } catch (error) {
        console.error("Error fetching routines:", error);
        res.status(500).json({ message: "Internal server error" });
      }
    });

    app.get("/routine/:batchId", async (req, res) => {
      const { batchId } = req.params;

      // Validate batchId format
      if (!ObjectId.isValid(batchId)) {
        return res.status(400).send({ error: "Invalid batch ID format" });
      }

      try {
        // Convert batchId to ObjectId
        const batchObjectId = new ObjectId(batchId);

        // Find all routine entries for the specific batch
        const routines = await routineCollection
          .find({ batchId: batchObjectId })
          .toArray();

        // If no routines found, return empty array
        if (!routines || routines.length === 0) {
          return res.status(200).json([]);
        }

        // Return the routines directly
        res.status(200).json(routines);
      } catch (error) {
        console.error("Error fetching routine:", error);
        res.status(500).json({
          message: "Failed to fetch the routine",
          error: error.message,
        });
      }
    });

    app.put("/routine/:batchId", async (req, res) => {
      const { batchId } = req.params;
      const routines = req.body;

      if (!ObjectId.isValid(batchId)) {
        return res.status(400).send({ error: "Invalid batch ID format" });
      }

      if (!Array.isArray(routines)) {
        return res.status(400).send({ error: "Routines must be an array" });
      }

      const isValidRoutines = routines.every(
        (routine) => routine.day && routine.startTime && routine.endTime
      );
      if (!isValidRoutines) {
        return res.status(400).send({ error: "Invalid routine entry format" });
      }

      try {
        const batchObjectId = new ObjectId(batchId);

        const bulkOps = routines.map((routine) => {
          if (routine._id && ObjectId.isValid(routine._id)) {
            // Existing routine: Update it
            return {
              updateOne: {
                filter: { _id: new ObjectId(routine._id) },
                update: {
                  $set: {
                    day: routine.day,
                    startTime: routine.startTime,
                    endTime: routine.endTime,
                    batchId: batchObjectId,
                    createdAt: routine.createdAt || new Date().toISOString(),
                  },
                },
              },
            };
          } else {
            // New routine: Insert it
            return {
              insertOne: {
                document: {
                  batchId: batchObjectId,
                  day: routine.day,
                  startTime: routine.startTime,
                  endTime: routine.endTime,
                  createdAt: routine.createdAt || new Date().toISOString(),
                },
              },
            };
          }
        });

        await routineCollection.bulkWrite(bulkOps);

        // Fetch updated routines
        const updatedRoutines = await routineCollection
          .find({ batchId: batchObjectId })
          .toArray();

        res.status(200).json(updatedRoutines);
      } catch (error) {
        console.error("Error updating routines:", error);
        res.status(500).json({
          message: "Failed to update routines",
          error: error.message,
        });
      }
    });

    // app.patch("/routine/:batchId", async (req, res) => {
    //   const { batchId } = req.params; // Get batchId from the URL parameters
    //   const { schedule } = req.body; // Get updated schedule from the request body

    //   console.log("Incoming PATCH Request for batchId:", batchId);
    //   console.log("Updated Schedule:", schedule);

    //   if (!ObjectId.isValid(batchId)) {
    //     return res.status(400).send({ error: "Invalid batch ID format" });
    //   }

    //   try {
    //     // Convert batchId to ObjectId before querying (use 'new' keyword)
    //     const existingRoutine = await routineCollection.findOne({
    //       batchId: new ObjectId(batchId),
    //     });

    //     if (!existingRoutine) {
    //       // If routine with the batchId doesn't exist
    //       console.log(`Routine not found for batchId: ${batchId}`);
    //       return res.status(404).json({ message: "Routine not found" });
    //     }

    //     // If routine exists, update the schedule
    //     const updateResult = await routineCollection.updateOne(
    //       { batchId: new ObjectId(batchId) }, // Use 'new ObjectId()' here
    //       { $set: { schedule } } // Update the schedule field
    //     );

    //     if (updateResult.modifiedCount === 0) {
    //       // If no changes were made
    //       return res
    //         .status(400)
    //         .json({ message: "No changes were made to the routine." });
    //     }

    //     // Fetch and send back the updated routine
    //     const updatedRoutine = await routineCollection.findOne({
    //       batchId: new ObjectId(batchId),
    //     });
    //     res.status(200).json(updatedRoutine);
    //   } catch (error) {
    //     console.error("Error updating routine:", error);
    //     res
    //       .status(500)
    //       .json({
    //         message: "Failed to update the routine",
    //         error: error.message,
    //       });
    //   }
    // });

    app.get("/instructors/:instructorId/classes", async (req, res) => {
      const { instructorId } = req.params;

      // Validate instructorId
      if (!isValidObjectId(instructorId)) {
        return res.status(400).json({ message: "Invalid instructorId format" });
      }

      try {
        // Step 1: Get batches assigned to the instructor
        const assignedBatches = await instructorsBatchesCollection
          .find({ instructorId: new ObjectId(instructorId) })
          .toArray();

        const batchIds = assignedBatches.map(
          (entry) => new ObjectId(entry.batchId)
        );

        if (batchIds.length === 0) {
          return res
            .status(404)
            .json({ message: "No batches assigned to this instructor" });
        }

        // Step 2: Fetch routines for those batches
        const routines = await routineCollection
          .find({ batchId: { $in: batchIds } })
          .toArray();

        // Step 3: Combine all schedules with day, startTime, and endTime
        const scheduleMap = {};

        routines.forEach((routine) => {
          routine.schedule.forEach((session) => {
            const key = `${session.day} ${session.startTime} - ${session.endTime}`; // Corrected key

            if (!scheduleMap[key]) {
              scheduleMap[key] = [];
            }

            scheduleMap[key].push({
              batchId: routine.batchId,
              day: session.day,
              startTime: session.startTime,
              endTime: session.endTime,
            });
          });
        });

        // Step 4: Identify conflicts
        const conflicts = Object.entries(scheduleMap).filter(
          ([key, sessions]) => sessions.length > 1
        );

        if (conflicts.length > 0) {
          return res.status(400).json({
            success: false,
            message: "Instructor has schedule conflicts.",
            conflicts: conflicts.map(([key, sessions]) => ({
              dayTime: key,
              batches: sessions.map((s) => s.batchId),
            })),
          });
        }

        res.status(200).json({
          success: true,
          message: "Instructor's schedule is conflict-free.",
          schedule: scheduleMap,
        });
      } catch (error) {
        console.error("Error fetching instructor classes:", error);
        res.status(500).json({ message: "Internal server error" });
      }
    });

    app.post("/classes", async (req, res) => {
      const { batchId, instructorId, date, startTime, endTime } = req.body;

      if (!batchId || !instructorId || !date) {
        return res.status(400).json({
          success: false,
          message: "Batch ID, Instructor ID, and Date are required",
        });
      }

      try {
        const batchObjectId = new ObjectId(batchId);
        const instructorObjectId = new ObjectId(instructorId);

        // Check if a class entry already exists for the same batch on the same date
        const existingClass = await classesCollection.findOne({
          batchId: batchObjectId,
          date: date,
        });

        if (existingClass) {
          return res.status(400).json({
            success: false,
            message: "A class for this batch has already been recorded today",
          });
        }

        // Insert new class entry with startTime and endTime
        const newClass = {
          batchId: batchObjectId,
          instructorId: instructorObjectId,
          date,
          startTime: startTime || null,
          endTime: endTime || null,
        };

        const result = await classesCollection.insertOne(newClass);

        if (result.acknowledged) {
          res.status(201).json({
            success: true,
            message: "Class added successfully",
            classId: result.insertedId,
          });
        } else {
          res
            .status(500)
            .json({ success: false, message: "Failed to add class" });
        }
      } catch (error) {
        console.error("Error saving class:", error);
        res
          .status(500)
          .json({ success: false, message: "Internal server error" });
      }
    });

    app.get("/classes", async (req, res) => {
      try {
        console.log("Fetching all classes...");
        const classes = await classesCollection.find().toArray();
        console.log(`Found ${classes.length} classes`);

        // For each class, find the instructor's name
        const classesWithInstructors = await Promise.all(
          classes.map(async (classItem) => {
            console.log("\n--- Processing class ---");
            console.log("Class data:", classItem);

            // Check if instructorId is a valid ObjectId before converting
            let instructorObjectId;
            try {
              console.log("Instructor ID from class:", classItem.instructorId);
              instructorObjectId = new ObjectId(classItem.instructorId);
              console.log("Converted to ObjectId:", instructorObjectId);
            } catch (error) {
              console.log(
                "Error converting instructorId to ObjectId, using as is"
              );
              instructorObjectId = classItem.instructorId;
            }

            // Find the instructor document using the instructorId
            console.log("Looking for instructor with _id:", instructorObjectId);
            const instructor = await instructorsCollection.findOne({
              _id: instructorObjectId,
            });

            console.log("Instructor found:", instructor);

            if (instructor && instructor.userId) {
              console.log("Instructor userId:", instructor.userId);

              // Check if userId is a valid ObjectId before converting
              let userObjectId;
              try {
                userObjectId = new ObjectId(instructor.userId);
                console.log("Converted to ObjectId:", userObjectId);
              } catch (error) {
                console.log("Error converting userId to ObjectId, using as is");
                userObjectId = instructor.userId;
              }

              // Get the user data using the userId
              console.log("Looking for user with _id:", userObjectId);
              const user = await userCollection.findOne({
                _id: userObjectId,
              });

              console.log("User found:", user);
              console.log("User name:", user ? user.name : "No name found");

              return {
                ...classItem,
                instructorName: user ? user.name : "Unknown Instructor",
              };
            } else {
              console.log("No instructor found or no userId in instructor");
              return {
                ...classItem,
                instructorName: "Instructor Not Found",
              };
            }
          })
        );

        console.log("Returning final data with instructor names");
        res.send(classesWithInstructors);
      } catch (error) {
        console.error("Error fetching classes:", error);
        res
          .status(500)
          .send({ message: "Internal server error", error: error.message });
      }
    });

    app.patch("/classes/:classId", async (req, res) => {
      const { classId } = req.params;
      const { startTime, endTime } = req.body;
      console.log("Received classId:", classId);

      try {
        // Ensure at least one of startTime or endTime is provided
        if (!startTime && !endTime) {
          return res.status(400).json({
            message: "At least one of startTime or endTime is required.",
          });
        }

        // Build the update object dynamically
        const updateFields = {};
        if (startTime) updateFields.startTime = startTime;
        if (endTime) updateFields.endTime = endTime;

        if (!ObjectId.isValid(classId)) {
          return res.status(400).json({ message: "Invalid classId format." });
        }
        const classExists = await classesCollection.findOne({
          _id: new ObjectId(classId),
        });
        console.log(classExists);

        // Update the class document with provided fields
        const updatedClass = await classesCollection.findOneAndUpdate(
          { _id: new ObjectId(classId) }, // Find the class by classId
          { $set: updateFields }, // Dynamically set fields
          { returnDocument: "after" } // Return the updated document
        );

        console.log("Update result:", updatedClass);

        if (!updatedClass.value) {
          return res.status(404).json({ message: "Class not found." });
        }

        res.status(200).json({
          message: "Class updated successfully.",
          updatedClass: updatedClass.value,
        });
      } catch (error) {
        console.error("Error updating class:", error);
        res.status(500).json({ message: "Server error." });
      }
    });

    app.post("/results/upload", async (req, res) => {
      try {
        const { batchId, results } = req.body;

        if (!batchId || !results || !Array.isArray(results)) {
          return res.status(400).json({ message: "Invalid input data" });
        }

        let bulkOperations = results.map((result) => ({
          updateOne: {
            filter: { batchId, studentID: result.studentID }, // Find student by batchId & studentID
            update: {
              $set: {
                batchId,
                studentID: result.studentID,
                Mid_Term:
                  result.Mid_Term !== undefined ? result.Mid_Term : null,
                Project: result.Project !== undefined ? result.Project : null,
                Assignment:
                  result.Assignment !== undefined ? result.Assignment : null,
                Final_Exam:
                  result.Final_Exam !== undefined ? result.Final_Exam : null,
                Attendance:
                  result.Attendance !== undefined ? result.Attendance : null,
                createdAt: new Date(),
              },
            },
            upsert: true, // Insert if not found
          },
        }));

        const response = await resultCollection.bulkWrite(bulkOperations);

        res.status(201).json({
          message: "Results uploaded successfully",
          modifiedCount: response.modifiedCount,
          upsertedCount: response.upsertedCount,
        });
      } catch (error) {
        console.error("Error uploading results:", error);
        res.status(500).json({ message: "Internal server error" });
      }
    });

    app.get("/results", async (req, res) => {
      try {
        const results = await resultCollection.find({}).toArray();
        console.log("Fetched Results:", results);
        res.send(results);
      } catch (error) {
        console.error("Error fetching results:", error);
        res
          .status(500)
          .send({ message: "Internal server error", error: error.message });
      }
    });

    app.patch("/results/update", async (req, res) => {
      try {
        const { batchId, studentID, ...updatedFields } = req.body;

        if (!batchId || !studentID) {
          return res.status(400).json({ message: "Missing required fields" });
        }

        // Ensure only exam-related fields are updated
        const updateData = { createdAt: new Date() };
        Object.keys(updatedFields).forEach((key) => {
          updateData[key] =
            updatedFields[key] !== undefined ? updatedFields[key] : null;
        });

        const response = await resultCollection.updateOne(
          { batchId, studentID },
          { $set: updateData }
        );

        res.status(200).json({
          message: "Result updated successfully",
          modifiedCount: response.modifiedCount,
        });
      } catch (error) {
        console.error("Error updating result:", error);
        res.status(500).json({ message: "Internal server error" });
      }
    });

    app.delete("/results/:id", async (req, res) => {
      const { id } = req.params;
      try {
        const result = await resultCollection.deleteOne({
          _id: new ObjectId(id),
        });
        if (result.deletedCount === 1) {
          res.status(200).send({ message: "Result deleted successfully" });
        } else {
          res.status(404).send({ message: "Result not found" });
        }
      } catch (error) {
        res.status(500).send({ message: "Server error", error });
      }
    });

    app.get("/batch/:batchId/students", async (req, res) => {
      const { batchId } = req.params;

      try {
        console.log("Fetching students for batch:", batchId);

        // Fetch students enrolled in the batch with ObjectId
        const students = await studentsCollection
          .find({ enrolled_batch: new ObjectId(batchId), isDeleted: false })
          .toArray();

        console.log("Students found:", students);

        // Fetch user details for each student and map the results
        const studentData = await Promise.all(
          students.map(async (student) => {
            console.log("Processing student:", student);

            // Log the student.userId to verify its value
            console.log("Student userId:", student.userId);

            const user = await userCollection.findOne({
              _id: new ObjectId(student.userId),
              type: "student",
            });

            // Log the user data to see if it's fetched correctly
            console.log("User data for student:", user);

            return {
              studentID: student.studentID,
              name: user ? user.name : "Unknown",
            };
          })
        );

        console.log("Student data:", studentData);

        res.status(200).json(studentData);
      } catch (error) {
        console.error("Error fetching students:", error);
        res.status(500).json({ message: "Server error" });
      }
    });

    app.get("/results/checkExisting", async (req, res) => {
      const { batchId, studentID } = req.query;

      try {
        // Check if the result already exists for the student in the batch
        const existingResults = await resultCollection
          .find({
            batchId,
            studentID,
          })
          .toArray();

        // Respond with existing results
        res.json(existingResults);
      } catch (error) {
        console.error("Error checking existing results:", error);
        res.status(500).json({ message: "Internal server error" });
      }
    });

    app.delete("/instructors-batches/:id", async (req, res) => {
      const { id } = req.params;

      // Check if the provided id is valid ObjectId
      if (!ObjectId.isValid(id)) {
        return res.status(400).json({ message: "Invalid instructor batch ID" });
      }

      try {
        // Log the ID being passed for deletion
        console.log(`Attempting to delete instructor batch with ID: ${id}`);

        // Check if the batch exists
        const existingBatch = await instructorsBatchesCollection.findOne({
          _id: new ObjectId(id),
        });
        if (!existingBatch) {
          return res
            .status(404)
            .json({ message: "Instructor batch mapping not found" });
        }

        // Proceed to delete
        const result = await instructorsBatchesCollection.deleteOne({
          _id: new ObjectId(id),
        });

        if (result.deletedCount === 0) {
          return res
            .status(404)
            .json({ message: "Instructor batch mapping not found" });
        }

        res
          .status(200)
          .json({ message: "Instructor removed from batch successfully" });
      } catch (error) {
        console.error("Error deleting instructor from batch:", error);
        res
          .status(500)
          .json({ message: "Internal server error", error: error.message });
      }
    });

    app.post("/notice", async (req, res) => {
      try {
        console.log("📥 Received Notice Data:", req.body);

        const { title, description, tags, attachment, deadline } = req.body;

        if (!title || !description) {
          console.warn("⚠️ Missing Required Fields:", { title, description });
          return res
            .status(400)
            .json({ message: "Title and description are required." });
        }

        console.log("📌 Parsed Notice Data:", {
          title,
          description,
          tags,
          attachment,
          deadline,
        });

        // Prepare the notice data for insertion
        const newNotice = {
          title,
          description,
          tags,
          attachment,
          deadline,
          createdAt: new Date(),
        };

        // Insert into MongoDB collection
        const result = await noticeCollection.insertOne(newNotice);

        console.log("✅ Notice saved to DB:", result);

        // Send success response with the saved notice data
        res
          .status(201)
          .json({ message: "Notice created successfully", notice: newNotice });
      } catch (error) {
        console.error("❌ Error saving notice:", error);
        res.status(500).json({ message: "Server error" });
      }
    });

    // Backend route
    app.get("/notice", async (req, res) => {
      try {
        const notices = await noticeCollection.find({}).toArray();

        console.log("✅ Notices fetched:", notices.length);

        res.setHeader("Content-Type", "application/json");
        res.status(200).json(notices);
      } catch (error) {
        console.error("❌ Error in /notice route:", error);

        res.setHeader("Content-Type", "application/json");
        res.status(500).json({
          message: "Server error",
          error: error.toString(),
          stack: error.stack,
        });
      }
    });

    app.delete("/notice/:id", async (req, res) => {
      const { id } = req.params;

      try {
        // Find and delete the notice by its ID from the "noticeCollection"
        const result = await noticeCollection.deleteOne({
          _id: new ObjectId(id),
        });

        if (result.deletedCount === 1) {
          return res
            .status(200)
            .json({ message: "Notice deleted successfully" });
        } else {
          return res.status(404).json({ message: "Notice not found" });
        }
      } catch (error) {
        console.error("Error deleting notice:", error);
        return res
          .status(500)
          .json({ message: "An error occurred while deleting the notice" });
      }
    });

    app.patch("/notice/:id", async (req, res) => {
      const { id } = req.params;
      const updatedNotice = req.body;

      try {
        const result = await noticeCollection.updateOne(
          { _id: new ObjectId(id) },
          { $set: updatedNotice }
        );

        if (result.matchedCount === 0) {
          return res.status(404).json({ message: "Notice not found" });
        }

        return res.status(200).json({ message: "Notice updated successfully" });
      } catch (error) {
        console.error("Error updating notice:", error);
        return res.status(500).json({
          message: "An error occurred while updating the notice",
          error: error.toString(),
        });
      }
    });


    app.post("/batch-change-requests", async (req, res) => {
      try {
        const { studentId, requestedBatch } = req.body;
        if (!studentId || !requestedBatch) {
          return res.status(400).json({ message: "Missing required fields" });
        }
    
        // Create batch change request
        const batchRequest = {
          studentId: new ObjectId(studentId),
          requestedBatch: new ObjectId(requestedBatch),
          status: "Pending",
          timestamp: new Date(),
        };
    
        await batchChangeRequestCollection.insertOne(batchRequest);
        res.status(201).json({ message: "Batch change request submitted successfully" });
      } catch (error) {
        console.error("Error handling batch change request:", error);
        res.status(500).json({ message: "Internal server error" });
      }
    });

    app.get("/batch-change-requests", async (req, res) => {
      try {
        // Optionally, you can filter based on status or studentId
        const { status, studentId } = req.query;
        let filter = {};
    
        // Apply filters if specified
        if (status) {
          filter.status = status;
        }
        if (studentId) {
          filter.studentId = new ObjectId(studentId);
        }
    
        // Fetch batch change requests from the database
        const batchChangeRequests = await batchChangeRequestCollection.find(filter).toArray();
        
        res.status(200).json(batchChangeRequests);
      } catch (error) {
        console.error("Error fetching batch change requests:", error);
        res.status(500).json({ message: "Internal server error" });
      }
    });
    

    await client.db("admin").command({ ping: 1 });
    console.log(
      "Pinged your deployment. You successfully connected to MongoDB!"
    );
  } finally {
    // await client.close();
  }
}

run().catch(console.dir);

app.get("/", (req, res) => {
  res.send("just_edge is connecting");
});

app.listen(port, () => {
  console.log(`justEdge is sitting on port ${port}`);
});
