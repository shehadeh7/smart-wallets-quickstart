# Smart Wallets Quickstart (Next.js)

Use this template to get started with **embedded smart wallets** using [Alchemy Account Kit](https://www.alchemy.com/docs/wallets).

## ✨ Features

- Email, passkey & social login using pre‑built UI components
- Flexible, secure, and cheap smart accounts
- Gasless transactions powered by ERC-4337 Account Abstraction
- One‑click NFT mint (no ETH required)
- Server‑side rendering ready – session persisted with cookies
- TailwindCSS + shadcn/ui components, React Query, TypeScript

![Smart Wallet Quickstart](https://github.com/user-attachments/assets/2903fb78-e632-4aaa-befd-5775c60e1ca2)

## 📍 Network & Demo Contract

This quickstart is configured to run on **Arbitrum Sepolia** testnet, by default. A free demo NFT contract has been deployed specifically for this quickstart, allowing you to mint NFTs without any setup or deployment steps. The contract is pre-configured and ready to use out of the box.

## 🚀 Quick start

### Scaffold a new app

```bash
npm create next-app smart-wallets-quickstart -- --example https://github.com/alchemyplatform/smart-wallets-quickstart
cd smart-wallets-quickstart
```

### 🔧 Configure

Get your pre-configured API key and policy ID from the [Smart Wallets dashboard](https://dashboard.alchemy.com/services/smart-wallets/configuration) by viewing one of your configurations. You will get a default app, configuration, and sponsorship policy created for you to quickly start testing.

Once you have your keys, add them to your `.env.local ` file.

```bash
cp .env.example .env.local      # create if missing
# add NEXT_PUBLIC_ALCHEMY_API_KEY=...
# add NEXT_PUBLIC_ALCHEMY_POLICY_ID=...
```

| Variable                        | Purpose                                                                                                     |
| ------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| `NEXT_PUBLIC_ALCHEMY_API_KEY`   | API key for your Alchemy [app](https://dashboard.alchemy.com/services/smart-wallets/configuration)          |
| `NEXT_PUBLIC_ALCHEMY_POLICY_ID` | Gas Manager policy ID for [sponsorship](https://dashboard.alchemy.com/services/smart-wallets/configuration) |

If instead you want to set up your own configurations from scratch you should:

1. Create a new Alchemy [app](https://dashboard.alchemy.com/apps)
2. Set up a new Smart Wallet [configruation](https://dashboard.alchemy.com/services/smart-wallets/configuration) for your app to specify login methods
3. Create a gas sponsorship [policy](https://dashboard.alchemy.com/services/gas-manager/configuration) for your app

Note: for production, you should [protect](https://www.alchemy.com/docs/wallets/resources/faqs#how-should-i-protect-my-api-key-and-policy-id-in-the-frontend) your API key and policy ID behind a server rather than exposing client side.

### Run your app!

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000), first **Login**, then try minting a new NFT.

Congrats! You've created a new smart wallet and sent your first sponsored transaction!

See what else you can do with [smart wallets](https://www.alchemy.com/docs/wallets/react/overview).

## 🗂 Project layout

```
app/           # Next.js pages & components
components/ui/ # shadcn/ui primitives
lib/           # constants & helpers
config.ts      # Account Kit + Gas Sponsorship setup
tailwind.config.ts
```

## 🏗️ How it works

1. `config.ts` initializes Account Kit with your API key, chain, and Gas Sponsorship policy.
2. `Providers` wraps the app with `AlchemyAccountProvider` & React Query.
3. `LoginCard` opens the authentication modal (`useAuthModal`).
4. After login, `useSmartAccountClient` exposes the smart wallet.
5. `NftMintCard` uses `useSendUserOperation` to call `mintTo()` on the demo ERC‑721, with gas paid by the Paymaster.

## 📚 Docs & resources

- React Quickstart → [https://www.alchemy.com/docs/wallets/react/quickstart](https://www.alchemy.com/docs/wallets/react/quickstart)
- Gas Manager quickstart → [https://www.alchemy.com/docs/wallets/infra/quickstart](https://www.alchemy.com/docs/wallets/infra/quickstart)

## 🖥 Scripts

```bash
npm run dev     # start development server
npm run build   # production build
npm run start   # run production build
npm run lint    # lint code
```

## 🛂 License

MIT

## Testing Steps
1. Create a burner email through https://temp-mail.org/en/view/6923c5e9d4f26d006aadab17 or some other site
2. Run the local app (clear .data if needed, but i dont think it's necessary)
3. Once logged in, user will have a wallet address. Go to https://faucet.circle.com/ to fund the wallet address with USDC
4. You can now subscribe (you can actually subscribe without funding, but ideally shouldn't allow subscription without money in account)
5. Can run the merchant script once subscribed with `npx ts-node scripts/merchant-test.ts`
6. View the transactions logs in sepolia etherscas
