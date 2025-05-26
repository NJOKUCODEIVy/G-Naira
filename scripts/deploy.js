const hre = require("hardhat");

async function main() {
    console.log("🚀 Starting G-Naira (gNGN) Deployment...\n");

    // Get the deployer account
    const [deployer] = await hre.ethers.getSigners();
    console.log("📝 Deploying contracts with account:", deployer.address);
    console.log("💰 Account balance:", hre.ethers.formatEther(await hre.ethers.provider.getBalance(deployer.address)), "ETH\n");

    try {
        // Step 1: Deploy MultiSigWallet
        console.log("🔐 Deploying MultiSigWallet...");
        
        // Multi-sig wallet owners (include deployer and additional owners)
        const multisigOwners = [
            deployer.address,
            "0x1ac0D33437aaC3243deE9334187dcfDadB9F389B",
            "0x2B1802AE213D8C6431A9d11806d065F8E9521262",
            "0x7797b38811048A73878Eed7431B03F6f1dAF4E4a",
            "0xCC88D775962fBB309cac3d2C377c61adB59A8294",
            "0x71055387573d02D68baf9EA6aef95df465A524d6"
        ];  
        
        // Number of required confirmations (adjust based on number of owners)
        const requiredConfirmations = Math.ceil(multisigOwners.length / 2); // Majority rule
        
        const MultiSigWallet = await hre.ethers.getContractFactory("MultiSigWallet");
        const multiSigWallet = await MultiSigWallet.deploy(multisigOwners, requiredConfirmations);
        await multiSigWallet.waitForDeployment();
        
        const multiSigAddress = await multiSigWallet.getAddress();
        console.log("✅ MultiSigWallet deployed to:", multiSigAddress);
        console.log("👥 Owners:", multisigOwners.length);
        console.log("📊 Required confirmations:", requiredConfirmations, "\n");

        // Step 2: Deploy GNaira Token
        console.log("💰 Deploying GNaira Token...");
        
        const GNaira = await hre.ethers.getContractFactory("GNaira");
        
        // Deploy with deployer as initial governor (will transfer to multisig later)
        const gNaira = await GNaira.deploy(deployer.address);
        await gNaira.waitForDeployment();
        
        const gNairaAddress = await gNaira.getAddress();
        console.log("✅ GNaira token deployed to:", gNairaAddress);
        console.log("👑 Initial Governor:", deployer.address, "\n");

        // Step 3: Transfer Governor Role to MultiSig (Optional - for production)
        console.log("🔄 Transferring Governor role to MultiSig...");
        
        const transferTx = await gNaira.setGovernor(multiSigAddress);
        await transferTx.wait();
        
        console.log("✅ Governor role transferred to MultiSig:", multiSigAddress, "\n");

        // Step 4: Initial Setup (Optional - mint initial supply)
        console.log("⚙️  Performing initial setup...");
        
        // Note: Since governor is now multisig, minting would require multisig approval
        // For testing, we can mint before transferring governor role
        
        // Re-deploy with direct governor setup for initial minting if needed
        console.log("💡 For initial minting, use the MultiSig wallet to propose and execute mint transactions\n");

        // Step 5: Verification (if on testnet/mainnet)
        if (hre.network.name !== "hardhat" && hre.network.name !== "localhost") {
            console.log("🔍 Waiting for block confirmations before verification...");
            await new Promise(resolve => setTimeout(resolve, 60000)); // Wait 1 minute
            
            try {
                console.log("📋 Verifying contracts on Etherscan...");
                
                // Verify MultiSigWallet
                await hre.run("verify:verify", {
                    address: multiSigAddress,
                    constructorArguments: [multisigOwners, requiredConfirmations],
                });
                console.log("✅ MultiSigWallet verified");
                
                // Verify GNaira
                await hre.run("verify:verify", {
                    address: gNairaAddress,
                    constructorArguments: [multiSigAddress], // Governor is now multisig
                });
                console.log("✅ GNaira token verified");
                
            } catch (error) {
                console.log("⚠️  Verification failed:", error.message);
            }
        }

        // Step 6: Display Summary
        console.log("\n" + "=".repeat(60));
        console.log("🎉 DEPLOYMENT COMPLETED SUCCESSFULLY!");
        console.log("=".repeat(60));
        console.log("📋 Contract Addresses:");
        console.log("   🔐 MultiSigWallet:", multiSigAddress);
        console.log("   💰 GNaira (gNGN):", gNairaAddress);
        console.log("\n📊 Token Details:");
        console.log("    Name: G-Naira");
        console.log("   🏷️  Symbol: gNGN");
        console.log("   🔢 Decimals: 18");
        console.log("   👑 Governor: MultiSig Wallet");
        console.log("\n🔐 MultiSig Details:");
        console.log("   👥 Owners:", multisigOwners.length);
        console.log("   ✅ Required Confirmations:", requiredConfirmations);
    
        console.log("=".repeat(60));

        // Return deployment info for scripts/testing
        return {
            multiSigWallet: {
                address: multiSigAddress,
                contract: multiSigWallet
            },
            gNaira: {
                address: gNairaAddress,
                contract: gNaira
            },
            deployer: deployer.address,
            network: hre.network.name
        };

    } catch (error) {
        console.error("❌ Deployment failed:", error);
        throw error;
    }
}

// Execute deployment
if (require.main === module) {
    main()
        .then(() => process.exit(0))
        .catch((error) => {
            console.error("💥 Fatal deployment error:", error);
            process.exit(1);
        });
}

module.exports = main;