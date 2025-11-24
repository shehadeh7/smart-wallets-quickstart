
// scripts/merchant-test.ts
import "dotenv/config";
import { encodeFunctionData } from "viem";
import { sepolia, alchemy } from "@account-kit/infra";
import { LocalAccountSigner } from "@aa-sdk/core";
import { createModularAccountV2Client } from "@account-kit/smart-contracts";


const USDC_SEPOLIA = "0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238";
const VALIDATION_ENTITY_ID = 2;
const DECIMALS = 6n;

// Read env
const {
  ALCHEMY_API_KEY,
  GAS_MANAGER_POLICY_ID,
  SESSION_KEY_PRIVATE_KEY,
  CUSTOMER_ACCOUNT_ADDRESS, // the smart account address that installed the session key
} = process.env;

function requireEnv(name: string, value: string | undefined) {
  if (!value) throw new Error(`${name} env var required`);
  return value;
}

async function main() {
  const apiKey = requireEnv("ALCHEMY_API_KEY", ALCHEMY_API_KEY);
  const policyId = requireEnv("GAS_MANAGER_POLICY_ID", GAS_MANAGER_POLICY_ID);
  const sessionKeyPrivate = ""; // Replace with customer's session key private key
  const accountAddress = "0x9dE1D8D330392C4c699f1885F6Db4eEe006345e4";
  const merchant = "0xdbcafd921b6b2e3d92d0d8b6489cf3d84dbf149f";

  // Prepare signer from the session key private key
  const sessionKeySigner = LocalAccountSigner.privateKeyToAccountSigner(sessionKeyPrivate);
  const sessionKeyAddress = await sessionKeySigner.getAddress();
  console.log("Session Key Address:", sessionKeyAddress);
  console.log("Customer Account Address:", accountAddress);
  console.log("Merchant Address:", merchant);

  // Create client bound to the customer smart account, using the session key signer
  const sessionKeyClient = await createModularAccountV2Client({
    chain: sepolia,
    transport: alchemy({ apiKey }),
    signer: sessionKeySigner,
    accountAddress: accountAddress,
    initCode: "0x", // already deployed
    signerEntity: { entityId: VALIDATION_ENTITY_ID, isGlobalValidation: true },
    policyId, // Paymaster policy ID for gas
  });

  // Utility to send a USDC transfer to the merchant
  const sendUsdc = async (amountUnits: bigint, note: string) => {
    console.log(`\n→ ${note} | Amount (USDC): ${Number(amountUnits) / Number(10n ** DECIMALS)} | raw: ${amountUnits}`);

    const uo = await sessionKeyClient.sendUserOperation({
      uo: {
        target: USDC_SEPOLIA,
        data: encodeFunctionData({
          abi: [
            {
              name: "transfer",
              type: "function",
              inputs: [
                { name: "to", type: "address" },
                { name: "amount", type: "uint256" },
              ],
              outputs: [{ type: "bool" }],
            },
          ],
          functionName: "transfer",
          args: [merchant, amountUnits],
        }),
        value: 0n,
      },
    });

    console.log("UserOp hash:", uo.hash);
    const tx = await sessionKeyClient.waitForUserOperationTransaction({ hash: uo.hash });
    console.log("✓ Transaction sent:", tx);
    return tx;
  };

  // --- TEST SEQUENCE ---
  // Plan cap set to 10 USDC per period in your hooks.
  const nineUSDC = 9n * (10n ** DECIMALS);
  const oneUSDC  = 1n * (10n ** DECIMALS);
  const extraUSDC = 1n * (10n ** DECIMALS);     // exceeds the cap after 9 + 1
  // If you prefer a tiny extra, use: const extraUSDC = 1n * (10n ** (DECIMALS - 1n)); // 0.1 USDC

  try {
    console.log("\n=== Test 1: 9 USDC (should succeed) ===");
    await sendUsdc(nineUSDC, "Payment #1 (9 USDC)");

    console.log("\n=== Test 2: 1 USDC (should succeed, total now 10 USDC) ===");
    await sendUsdc(oneUSDC, "Payment #2 (1 USDC)");

    console.log("\n=== Test 3: Another transfer (should FAIL: exceeds 10 USDC cap) ===");
    try {
      await sendUsdc(extraUSDC, "Payment #3 (exceeds cap)");
      console.error("Unexpected success: the transfer should have been blocked by subscription limits.");
    } catch (err: any) {
      const msg = err?.message ?? String(err);
      // Your module should revert with a reason like "ExceedsCap" (or similar).
      const expected = /ExceedsCap|exceed|cap|limit/i.test(msg);
      console.log(expected ? "✓ Expected revert detected due to cap." : "Received error (check logs):", msg);
    }
  } catch (fatal: any) {
    console.error("Fatal error during tests:", fatal?.message ?? fatal);
    process.exitCode = 1;
  }
}


/**
 * Non-ERC20 operation test: tries a native ETH transfer using the session key signer.
 * Expected behavior: your hooks should reject this operation (only ERC-20 transfer to merchant is allowed).
 */
export async function testNonErc20Op() {
  const apiKey = requireEnv("ALCHEMY_API_KEY", process.env.ALCHEMY_API_KEY);
  const policyId = requireEnv("GAS_MANAGER_POLICY_ID", process.env.GAS_MANAGER_POLICY_ID);
  const sessionKeyPrivate = ""; // Replace with customer's session key private key
  const accountAddress = "0x9dE1D8D330392C4c699f1885F6Db4eEe006345e4";
  const merchant = "0xdbcafd921b6b2e3d92d0d8b6489cf3d84dbf149f";

  const sessionKeySigner = LocalAccountSigner.privateKeyToAccountSigner(sessionKeyPrivate);
  const sessionKeyAddress = await sessionKeySigner.getAddress();

  console.log("Session Key Address:", sessionKeyAddress);
  console.log("Customer Account Address:", accountAddress);
  console.log("Merchant Address:", merchant);

  const client = await createModularAccountV2Client({
    chain: sepolia,
    transport: alchemy({ apiKey }),
    signer: sessionKeySigner,
    accountAddress,
    initCode: "0x", // already deployed
    signerEntity: { entityId: VALIDATION_ENTITY_ID, isGlobalValidation: true },
    policyId,
  });

  // Attempt a native ETH transfer (non-ERC20) — should FAIL.
  const tinyEthWei = 100000000000000n; // 0.0001 ETH

  console.log("\n=== Test: NON-ERC20 native ETH transfer (should FAIL) ===");
  try {
    const uo = await client.sendUserOperation({
      uo: {
        target: merchant, // EOA target, not a token contract
        data: "0x",       // empty calldata => native transfer
        value: tinyEthWei,
      },
    });

    console.log("UserOp hash:", uo.hash);
    const tx = await client.waitForUserOperationTransaction({ hash: uo.hash });

    // If we reach here, the hooks did NOT block it.
    console.error("⚠️ Unexpected success: native transfer should be blocked by subscription hooks.");
    console.error("Transaction:", tx);
  } catch (err: any) {
    const msg = err?.message ?? String(err);
    // Reason string varies by module; we just assert it failed.
    console.log("✓ Expected rejection for non-ERC20 operation.");
    console.log("Error:", msg);
  }
}


// main().catch((e) => {
//   console.error("Unhandled error:", e);
//   process.exitCode = 1;
// });
testNonErc20Op().catch((e) => {
  console.error("Unhandled error:", e);
  process.exitCode = 1;
});