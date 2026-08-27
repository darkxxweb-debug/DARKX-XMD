"use strict";

/**
 * Single shared MongoDB connection used to persist WhatsApp session
 * credentials (so sessions survive restarts/redeploys instead of living
 * only on local disk).
 */

const { MongoClient } = require('mongodb');

const uri = process.env.MONGODB_URI ||
    'mongodb+srv://mrxdeveloper2_db_user:P0DWc9vFOXICW4aa@cluster0.8n43fok.mongodb.net/?appName=Cluster0';

let client = null;
let dbPromise = null;

function getDb() {
    if (!dbPromise) {
        client = new MongoClient(uri, {
            maxPoolSize: 20,
            serverSelectionTimeoutMS: 15000,
        });
        dbPromise = client.connect()
            .then((c) => {
                console.log('🗄️  Connected to MongoDB');
                return c.db('darkx_ultra');
            })
            .catch((err) => {
                console.error('❌ MongoDB connection failed:', err.message);
                dbPromise = null; // allow retry on next call
                throw err;
            });
    }
    return dbPromise;
}

module.exports = { getDb };
