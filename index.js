const express = require('express');
const app = express();
const cors = require('cors');
require('dotenv').config()
const port = process.env.PORT || 5000;

// middleware
app.use(cors());
  
app.use(express.json());

console.log(process.env.DB_USER)
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const uri = "mongodb+srv://just_edge:gFMaSV8z7Wg3TwGS@cluster0.eogwfq1.mongodb.net/?retryWrites=true&w=majority";
// const uri = `mongodb+srv://${encodeURIComponent(process.env.DB_USER)}:${encodeURIComponent(process.env.DB_PASS)}@cluster0.swu9d.mongodb.net/?retryWrites=true&w=majority`;


// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  }
});

async function run() {
  try {
     // Connect the client to the server	(optional starting in v4.7)
   

     const userCollection = client.db("just_edge").collection("users");
     const coursesCollection = client.db("just_edge").collection("courses");
     
     

  //  jwt related api
   app.post('/jwt', async (req, res) => {
    const user = req.body;
    const token = jwt.sign(user, process.env.ACCESS_TOKEN_SECRET, { expiresIn: '1h' });
    res.send({ token });
  })


  // middlewares 
  const verifyToken = (req, res, next) => {
    if (!req.headers.authorization) {
      return res.status(401).send({ message: 'unauthorized access' });
    }
    const token = req.headers.authorization.split(' ')[1];
    jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, decoded) => {
      if (err) {
        return res.status(401).send({ message: 'unauthorized access' })
      }
      req.decoded = decoded;
      next();
    })
  }



const verifyAdmin = async (req, res, next) => {
  const email = req.decoded.email;
  const query = { email: email };
  const user = await userCollection.findOne(query);

  // Check if user is defined and has the 'type' property
  const isAdmin = user && user.type === 'admin';

  if (!isAdmin) {
    return res.status(403).send({ message: 'forbidden access' });
  }
  next();
};


  // users related api
  app.get('/users', verifyToken, verifyAdmin, async (req, res) => {
    const result = await userCollection.find().toArray();
    res.send(result);
  });

  app.get('/users/admin/:email', verifyToken, async (req, res) => {
    const email = req.params.email;

    if (email !== req.decoded.email) {
      return res.status(403).send({ message: 'forbidden access' })
    }

    const query = { email: email };
    const user = await userCollection.findOne(query);
    let admin = false;
    if (user) {
      admin = user?.type === 'admin';
    }
    res.send({ admin });
  })

  app.post('/users', async (req, res) => {
    const user = req.body;
    // insert email if user doesnt exists: 
    // you can do this many ways (1. email unique, 2. upsert 3. simple checking)
    const query = { email: user.email }
    const existingUser = await userCollection.findOne(query);
    if (existingUser) {
      return res.send({ message: 'user already exists', insertedId: null })
    }
    const result = await userCollection.insertOne(user);
    res.send(result);
  });


  app.get('/users',  async (req, res) => {
    const result = await userCollection.find().toArray();
    res.send(result);
  })


  app.get('/courses',  async (req, res) => {
    const result = await coursesCollection.find().toArray();
    res.send(result);
  })



     // Send a ping to confirm a successful connection
     await client.db("admin").command({ ping: 1 });
     console.log("Pinged your deployment. You successfully connected to MongoDB!");
  

  }
  finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.dir);


app.get('/', (req, res) => {
  res.send('just_edge is connecting')
})

app.listen(port, () => {
  console.log(`justEdge is sitting on port ${port}`);
})