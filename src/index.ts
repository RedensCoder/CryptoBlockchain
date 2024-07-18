const express = require("express");
const cors = require("cors");
const {config} = require("dotenv");

import {Express} from "express";

const Wallet = require("./handlers/wallet");

config()

const app: Express = express();

app.use(cors());
app.use(express.json());

app.use("/wallet", Wallet);

app.listen(8080, () => console.log("Server started..."));