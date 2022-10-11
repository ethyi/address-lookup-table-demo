import {
  Connection,
  Keypair,
  PublicKey,
  TransactionInstruction,
  VersionedTransaction,
  TransactionMessage,
} from "@solana/web3.js";

export function createKeypairFromFile(path: string): Keypair {
  return Keypair.fromSecretKey(
    Buffer.from(JSON.parse(require("fs").readFileSync(path, "utf-8")))
  );
}

export async function sendTransactionV0(
  connection: Connection,
  instructions: TransactionInstruction[],
  payer: Keypair
): Promise<void> {
  let blockhash = await connection.getLatestBlockhash();

  const messageV0 = new TransactionMessage({
    payerKey: payer.publicKey,
    recentBlockhash: blockhash.blockhash,
    instructions,
  }).compileToV0Message();

  const tx = new VersionedTransaction(messageV0);
  tx.sign([payer]);
  const sx = await connection.sendTransaction(tx);
  const confirm = await connection.confirmTransaction({
    blockhash: blockhash.blockhash,
    lastValidBlockHeight: blockhash.lastValidBlockHeight,
    signature: sx,
  });
  console.log(`** -- Signature: ${sx}`);
}

export async function sendTransactionV0WithLookupTable(
  connection: Connection,
  instructions: TransactionInstruction[],
  signatures: Keypair[],
  payer: Keypair,
  lookupTablePubkey: PublicKey
): Promise<void> {
  const lookupTableAccount = await connection
    .getAddressLookupTable(lookupTablePubkey)
    .then((res) => res.value);

  let blockhash = await connection.getLatestBlockhash();

  const messageV0 = new TransactionMessage({
    payerKey: payer.publicKey,
    recentBlockhash: blockhash.blockhash,
    instructions,
  }).compileToV0Message([lookupTableAccount]);

  const tx = new VersionedTransaction(messageV0);
  tx.sign(signatures);
  const sx = await connection.sendTransaction(tx);
  const confirm = await connection.confirmTransaction({
    blockhash: blockhash.blockhash,
    lastValidBlockHeight: blockhash.lastValidBlockHeight,
    signature: sx,
  });

  console.log(`** -- Signature: ${sx}`);
}

export async function printAddressLookupTable(
  connection: Connection,
  lookupTablePubkey: PublicKey
): Promise<void> {
  await delay(2);
  const lookupTableAccount = await connection
    .getAddressLookupTable(lookupTablePubkey)
    .then((res) => res.value);
  console.log(`Lookup Table: ${lookupTablePubkey}`);
  for (let i = 0; i < lookupTableAccount.state.addresses.length; i++) {
    const address = lookupTableAccount.state.addresses[i];
    console.log(`   Index: ${i}  Address: ${address.toBase58()}`);
  }
}

export async function printBalances(
  connection: Connection,
  timeframe: string,
  payer: PublicKey,
  pubKeys: PublicKey[]
): Promise<void> {
  console.log(`${timeframe}:`);

  console.log(`   payer balance : ${await connection.getBalance(payer)}`);
  for (let i = 0; i < pubKeys.length; i++) {
    const address = pubKeys[i];
    console.log(
      `   Index: ${i}  Address: ${address.toBase58()} Balance: ${await connection.getBalance(
        address
      )}`
    );
  }
}

function delay(s: number) {
  return new Promise((resolve) => setTimeout(resolve, s * 1000));
}
