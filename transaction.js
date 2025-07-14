const bitcoin = require('bitcoinjs-lib');
const ECPair = require('ecpair');
const CryptoAccount = require("send-crypto");

/* Load account from private key */
const privateKeyWIF = "L3fKJ...";
const keyPair = ECPair.fromWIF(privateKeyWIF);
const privateKey = keyPair.privateKey;
console.log(privateKey);
const account = new CryptoAccount(privateKey);

async function start() {
    console.log(await account.address("BTC"));

    console.log(await account.getBalance("BTC"));
    console.log(await account.getBalance("BTC", {address:"bc1qe6..."}));

    const balance = await account.getBalance("BTC");
    await account.send("bc1qe6...", balance, "BTC", {
            subtractFee: true,
    });

};
start();