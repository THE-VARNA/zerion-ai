import { execSync } from 'child_process';
console.log("Starting backoff swap...");
for (let i = 0; i < 15; i++) {
  try {
    const res = execSync("export ZERION_API_KEY=zk_8b76f3390afd4398af31db0d4f00c387 && export TREASURY_WALLET_PASSPHRASE=mi2026 && node cli/zerion.js swap pol usdc 19.3 --chain polygon --wallet treasury-wallet", { stdio: 'pipe' });
    console.log(res.toString());
    process.exit(0);
  } catch (err) {
    if (err.stdout) console.log(err.stdout.toString());
    console.log(`Attempt ${i+1} failed, waiting 5 seconds...`);
    execSync("sleep 5");
  }
}
