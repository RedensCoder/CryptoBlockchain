import {Router, Request, Response} from "express";
import Blockchain from "../util/blockchain";
import Gun from 'gun';
import 'gun/sea';

const gun = Gun();
const sea = Gun.SEA;

const router = Router();

const blockchain = new Blockchain();

router.post("/createWallet", async (req: Request, res: Response) => {
    const pair = await sea.pair();
    res.json({ publicKey: pair.pub, privateKey: pair.priv });
});

router.get("/getBalance/:pubKey", async (req: Request, res: Response) => {
    const balance = await blockchain.getBalance(req.params.pubKey);
    res.json({ balance });
});

router.post("/createTransaction", async (req: Request, res: Response) => {
    const { sender, recipient, amount } = req.body;
    try {
        const newBlock = await blockchain.createTransaction(sender, recipient, amount);
        res.json({ message: 'Transaction created', block: newBlock });
    } catch (error: any) {
        res.status(400).json({ error: error.message });
    }
});

router.get("/getMarketData", async (req: Request, res: Response) => {
    const marketData = await blockchain.getMarketData();
    res.json(marketData);
});

module.exports = router;