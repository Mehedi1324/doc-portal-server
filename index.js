const express = require("express");
const app = express();
const cors = require("cors");
require('dotenv').config();
const admin = require("firebase-admin");
const { MongoClient } = require('mongodb');
const ObjectId = require("mongodb").ObjectId;
const port = process.env.PORT || 5000;
const stripe = require("stripe")(process.env.STRIPE_SECRET);
// const fileUpload = require("express-fileUpload");


const serviceAccount = require("./docsportal-firebaseKey.json")
admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
});

app.use(cors());
// app.use(fileUpload());
app.use(express.json());



const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.mhfmk.mongodb.net/myFirstDatabase?retryWrites=true&w=majority`;
console.log(uri);
const client = new MongoClient(uri, { useNewUrlParser: true, useUnifiedTopology: true });



async function verifyToken(req, res, next) {
    if (req.headers?.authrization?.startsWith("Bearer ")) {
        const token = req.headers.authrization.split("")[1];

        try {
            const decodedUser = await admin.auth().verifyToken(token);
            req.decodedEmail = decodedUser.email;
        }
        catch {

        }

    }
    next();
}

async function run() {
    try {
        await client.connect();
        const database = client.db("doctors_portal");
        const appointmentsCollection = database.collection("appointments");
        const usersCollection = database.collection("users");
        const doctorsCollection = database.collection("doctors")
        // Getting data from storage
        app.get("/appointments", verifyToken, async (req, res) => {
            const email = req.query.email;
            const date = new Date(req.query.date).toLocaleDateString();
            const query = { email: email, date: date };
            const cursor = appointmentsCollection.find(query);
            const appointments = await cursor.toArray();
            res.json(appointments);
        })


        app.get("/appointments/:id", async (req, res) => {
            const id = req.params.id;
            const query = { _id: ObjectId(id) };
            const result = await appointmentsCollection.findOne(query);
            res.json(result);
        })


        // Doctors collection

        app.get("/doctors", async (req, res) => {
            const cursor = doctorsCollection.find({});
            const doctors = await cursor.toArray();
            res.json(doctors);
        })



        app.post("/doctors", async (req, res) => {
            const name = req.body.name;
            const email = req.body.email;
            const pic = req.files.image;
            const picData = pic.data;
            const encoddedPic = picData.toString("base64");
            const imageBuffer = Buffer.from(encoddedPic, "base64");
            const doctor = {
                name,
                email,
                image: imageBuffer
            }
            const result = await doctorsCollection.insertOne(doctor);
            res.json(result);
        })

        app.put("/appointments/:id", async (req, res) => {
            const id = req.params.id;
            const payment = req.body;
            const filter = { _id: ObjectId(id) };
            const updateDoc = {
                $set: {
                    payment: payment,

                }
            };
            const result = await appointmentsCollection.updateOne(filter, updateDoc);
            res.json(result);
        })



        app.post("/appointments", async (req, res) => {
            const appointment = req.body;
            const result = await appointmentsCollection.insertOne(appointment);
            res.json(result)
        });

        app.get("/users/:email", async (req, res) => {
            const email = req.params.email;
            const query = { email: email };
            const user = await usersCollection.findOne(query);
            let isAdmin = false;
            if (user?.role === "admin") {
                isAdmin = true;
            }
            res.json({ admin: isAdmin });
        })

        app.post("/users", async (req, res) => {
            const user = req.body;
            const result = await usersCollection.insertOne(user);
            console.log(result);
            res.json(result);
        })

        // FOr google register to save the user

        app.put("/users", async (req, res) => {
            const user = req.body;
            const query = { email: user.email };
            const options = { upsert: true };
            const updateDoc = { $set: user };
            const result = await usersCollection.updateOne(query, updateDoc, options);
            res.json(result);
        })
        app.put("/users/admin", verifyToken, async (req, res) => {
            const user = req.body;
            const requester = req.decodedEmail;
            if (requiens) {
                const requesterAccount = await usersCollection.findOne({ email: requester })
                if (requesterAccount.role === "admin") {

                    const query = { email: user.email };

                    const updateDoc = { $set: { role: "admin" } };
                    const result = await usersCollection.updateOne(query, updateDoc,);
                    res.json(result);
                }
            }
            else {
                res.status(401).json({ message: "you do not have permission" })
            }

        })

    }
    finally {
        //  await client.close();
    }

    app.post("/create-payment-intent", async (req, res) => {
        const paymentInfo = req.body;
        const amount = paymentInfo.price * 100;
        const paymentIntent = await stripe.paymentIntents.create({
            amount: amount,
            currency: "usd",
            payment_method_types: ["card"]

        });
        res.json({ clientSecret: paymentIntent.client_secret })

    })



}
run().catch(console.dir);


app.get("/", (req, res) => {
    res.send("Hello Doctor's portal  ")
})
app.listen(port, () => {
    console.log("Running on port", port)
})