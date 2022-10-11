import {
  AddressLookupTableProgram,
  Connection,
  Keypair,
  PublicKey,
  SystemProgram,
  TransactionInstruction,
} from "@solana/web3.js";
import { expect } from "chai";
import {
  createKeypairFromFile,
  printAddressLookupTable,
  printBalances,
  sendTransactionV0,
  sendTransactionV0WithLookupTable,
} from "./util";

describe("Address Lookup Tables!", () => {
  // needs ~ 0.05 SOL in devnet, total fee is 0.01
  const connection = new Connection(
    `https://api.devnet.solana.com`,
    "confirmed"
  );
  const payer = createKeypairFromFile(
    require("os").homedir() + "/.config/solana/id.json"
  );

  let lookupTablePubkey: PublicKey;

  const numberKeys = 40;
  const keyPairs = Array(numberKeys)
    .fill(0)
    .map((_, i) => Keypair.generate());
  const publicKeys = Array(numberKeys)
    .fill(0)
    .map((_, i) => keyPairs[i].publicKey);
  let initialBalance;
  let payerBalance;
  let newBalance;
  let fee;
  let minRent: number;
  it("Create an Address Lookup Table", async () => {
    minRent = await connection.getMinimumBalanceForRentExemption(0);
    console.log(`Min rent for lamport acc: ${minRent}`);
    payerBalance = await connection.getBalance(payer.publicKey);
    initialBalance = payerBalance;
    console.log(`Payer Balance: ${payerBalance}`);

    let ix: TransactionInstruction;
    // create lookip table instruction
    [ix, lookupTablePubkey] = AddressLookupTableProgram.createLookupTable({
      authority: payer.publicKey,
      payer: payer.publicKey,
      recentSlot: await connection.getSlot(),
    });

    await sendTransactionV0(connection, [ix], payer);

    await printAddressLookupTable(connection, lookupTablePubkey);
    newBalance = await connection.getBalance(payer.publicKey);
    fee = payerBalance - newBalance;
    payerBalance = newBalance;
    console.log(`Table Init Fee : ${fee}`);
    console.log(`Payer Balance: ${payerBalance}`);
  });

  it("Add some addresses to the ALT", async () => {
    const ix = AddressLookupTableProgram.extendLookupTable({
      addresses: publicKeys.slice(0, 20),
      authority: payer.publicKey,
      lookupTable: lookupTablePubkey,
      payer: payer.publicKey,
    });
    const ix2 = AddressLookupTableProgram.extendLookupTable({
      addresses: publicKeys.slice(20),
      authority: payer.publicKey,
      lookupTable: lookupTablePubkey,
      payer: payer.publicKey,
    });
    await sendTransactionV0(connection, [ix], payer);
    console.log("First 20 appended");
    await sendTransactionV0(connection, [ix2], payer);
    console.log("Last 20 appended");

    await printAddressLookupTable(connection, lookupTablePubkey);
    newBalance = await connection.getBalance(payer.publicKey);
    fee = payerBalance - newBalance;
    payerBalance = newBalance;
    console.log(`Table Extend Fee : ${fee}`);
    console.log(`Payer Balance: ${payerBalance}`);
  });

  it("Send a transactions WITHOUT using the ALT should FAIL", async () => {
    const instructions = Array(numberKeys)
      .fill(0)
      .map((_, i) =>
        SystemProgram.transfer({
          fromPubkey: payer.publicKey,
          toPubkey: publicKeys[i],
          lamports: minRent,
        })
      );
    async function shouldThrow() {
      await sendTransactionV0(connection, instructions, payer);

      await printBalances(
        connection,
        "After Transfer without ALT",
        payer.publicKey,
        publicKeys
      );
    }
    expect(shouldThrow).to.throw;
    newBalance = await connection.getBalance(payer.publicKey);
    fee = payerBalance - newBalance;
    payerBalance = newBalance;
    console.log(`Fund Acc without ALT Fee : ${fee}`);
    console.log(`Payer Balance: ${payerBalance}`);
  });

  it("Send same transactions using the ALT", async () => {
    const instructions = Array(numberKeys)
      .fill(0)
      .map((_, i) =>
        SystemProgram.transfer({
          fromPubkey: payer.publicKey,
          toPubkey: publicKeys[i],
          lamports: minRent,
        })
      );
    await sendTransactionV0WithLookupTable(
      connection,
      instructions,
      [payer],
      payer,
      lookupTablePubkey
    );

    await printBalances(
      connection,
      "After Transfer with ALT",
      payer.publicKey,
      publicKeys
    );
    newBalance = await connection.getBalance(payer.publicKey);

    let amountGiven = publicKeys.length * minRent;
    fee = payerBalance - newBalance - amountGiven;
    payerBalance = newBalance;
    console.log(`Amount given away : ${amountGiven}`);
    console.log(`Fund Acc with ALT Fee : ${fee}`);
    console.log(`Payer Balance: ${payerBalance}`);
  });

  it("Send lamports back to payer", async () => {
    const instructions = Array(numberKeys)
      .fill(0)
      .map((_, i) =>
        SystemProgram.transfer({
          fromPubkey: publicKeys[i],
          toPubkey: payer.publicKey,
          lamports: minRent,
        })
      );
    const INTERVAL = 5;
    let txCount = 0;
    for (let i = 0; i < numberKeys; i += INTERVAL) {
      let compressed_ix = instructions.slice(i, i + 5);

      await sendTransactionV0WithLookupTable(
        connection,
        compressed_ix,
        [...keyPairs.slice(i, i + 5), payer],
        payer,
        lookupTablePubkey
      );
      txCount++;
    }

    await printBalances(
      connection,
      "After reclaiming lamports",
      payer.publicKey,
      publicKeys
    );
    newBalance = await connection.getBalance(payer.publicKey);

    let amountTaken = publicKeys.length * minRent;
    fee = payerBalance - (newBalance - amountTaken);
    payerBalance = newBalance;
    console.log(`Amount taken back : ${amountTaken}`);
    console.log(`Number of tx needed: ${txCount}`);
    console.log(`Take back funds with ALT Fee : ${fee}`);
    console.log(`Fee per tx: ${fee / txCount}`);
    console.log(`Payer Balance: ${payerBalance}`);

    console.log(
      `Creating table, funding, and recieving 40 accounts TOTAL FEE: ${
        initialBalance - payerBalance
      }`
    );
  });
});
