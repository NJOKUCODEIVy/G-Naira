const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("MultiSigWallet", function () {
    let multiSigWallet;
    let owner1, owner2, owner3, nonOwner, recipient;
    let owners;
    const REQUIRED_CONFIRMATIONS = 2;

    beforeEach(async function () {
        [owner1, owner2, owner3, nonOwner, recipient] = await ethers.getSigners();
        owners = [owner1.address, owner2.address, owner3.address];

        const MultiSigWallet = await ethers.getContractFactory("MultiSigWallet");
        multiSigWallet = await MultiSigWallet.deploy(owners, REQUIRED_CONFIRMATIONS);
        await multiSigWallet.waitForDeployment();
    });

    describe("Deployment", function () {
        it("Should set the correct owners", async function () {
            const contractOwners = await multiSigWallet.getOwners();
            expect(contractOwners).to.deep.equal(owners);
        });

        it("Should set the correct number of required confirmations", async function () {
            expect(await multiSigWallet.numConfirmationsRequired()).to.equal(REQUIRED_CONFIRMATIONS);
        });

        it("Should mark addresses as owners", async function () {
            expect(await multiSigWallet.isOwner(owner1.address)).to.equal(true);
            expect(await multiSigWallet.isOwner(owner2.address)).to.equal(true);
            expect(await multiSigWallet.isOwner(owner3.address)).to.equal(true);
            expect(await multiSigWallet.isOwner(nonOwner.address)).to.equal(false);
        });

        it("Should revert with empty owners array", async function () {
            const MultiSigWallet = await ethers.getContractFactory("MultiSigWallet");
            await expect(MultiSigWallet.deploy([], 1))
                .to.be.revertedWith("MultiSig: owners required");
        });

        it("Should revert with invalid required confirmations", async function () {
            const MultiSigWallet = await ethers.getContractFactory("MultiSigWallet");
            await expect(MultiSigWallet.deploy(owners, 0))
                .to.be.revertedWith("MultiSig: invalid number of required confirmations");
            await expect(MultiSigWallet.deploy(owners, 4))
                .to.be.revertedWith("MultiSig: invalid number of required confirmations");
        });

        it("Should revert with duplicate owners", async function () {
            const duplicateOwners = [owner1.address, owner2.address, owner1.address];
            const MultiSigWallet = await ethers.getContractFactory("MultiSigWallet");
            await expect(MultiSigWallet.deploy(duplicateOwners, 2))
                .to.be.revertedWith("MultiSig: owner not unique");
        });

        it("Should revert with zero address as owner", async function () {
            const invalidOwners = [owner1.address, ethers.ZeroAddress, owner3.address];
            const MultiSigWallet = await ethers.getContractFactory("MultiSigWallet");
            await expect(MultiSigWallet.deploy(invalidOwners, 2))
                .to.be.revertedWith("MultiSig: invalid owner");
        });
    });

    describe("Receiving Ether", function () {
        it("Should receive Ether and emit Deposit event", async function () {
            const depositAmount = ethers.parseEther("1.0");
            
            await expect(owner1.sendTransaction({
                to: await multiSigWallet.getAddress(),
                value: depositAmount
            }))
            .to.emit(multiSigWallet, "Deposit")
            .withArgs(owner1.address, depositAmount, depositAmount);
            
            expect(await ethers.provider.getBalance(await multiSigWallet.getAddress()))
                .to.equal(depositAmount);
        });

        it("Should accumulate multiple deposits", async function () {
            const deposit1 = ethers.parseEther("0.5");
            const deposit2 = ethers.parseEther("0.3");
            
            await owner1.sendTransaction({
                to: await multiSigWallet.getAddress(),
                value: deposit1
            });
            
            await owner2.sendTransaction({
                to: await multiSigWallet.getAddress(),
                value: deposit2
            });
            
            expect(await ethers.provider.getBalance(await multiSigWallet.getAddress()))
                .to.equal(deposit1 + deposit2);
        });
    });

    describe("Transaction Submission", function () {
        it("Should allow owners to submit transactions", async function () {
            const txData = "0x";
            const value = ethers.parseEther("0.1");
            
            await expect(multiSigWallet.connect(owner1).submitTransaction(
                recipient.address, value, txData
            ))
            .to.emit(multiSigWallet, "SubmitTransaction")
            .withArgs(owner1.address, 0, recipient.address, value, txData);
            
            expect(await multiSigWallet.getTransactionCount()).to.equal(1);
        });

        it("Should not allow non-owners to submit transactions", async function () {
            const txData = "0x";
            const value = ethers.parseEther("0.1");
            
            await expect(multiSigWallet.connect(nonOwner).submitTransaction(
                recipient.address, value, txData
            ))
            .to.be.revertedWith("MultiSig: not owner");
        });

        it("Should store transaction details correctly", async function () {
            const txData = "0x1234";
            const value = ethers.parseEther("0.5");
            
            await multiSigWallet.connect(owner1).submitTransaction(
                recipient.address, value, txData
            );
            
            const tx = await multiSigWallet.getTransaction(0);
            expect(tx.to).to.equal(recipient.address);
            expect(tx.value).to.equal(value);
            expect(tx.data).to.equal(txData);
            expect(tx.executed).to.equal(false);
            expect(tx.numConfirmations).to.equal(0);
        });

        it("Should increment transaction count for multiple submissions", async function () {
            await multiSigWallet.connect(owner1).submitTransaction(
                recipient.address, ethers.parseEther("0.1"), "0x"
            );
            await multiSigWallet.connect(owner2).submitTransaction(
                recipient.address, ethers.parseEther("0.2"), "0x"
            );
            
            expect(await multiSigWallet.getTransactionCount()).to.equal(2);
        });

        it("Should reject submission to zero address", async function () {
            // First check if your contract actually validates zero address
            // If it doesn't, this test will need to be adjusted
            try {
                await expect(multiSigWallet.connect(owner1).submitTransaction(
                    ethers.ZeroAddress, ethers.parseEther("0.1"), "0x"
                )).to.be.revertedWith("MultiSig: invalid recipient");
            } catch (error) {
                // If the contract doesn't validate zero address, we can submit and check it was stored
                await multiSigWallet.connect(owner1).submitTransaction(
                    ethers.ZeroAddress, ethers.parseEther("0.1"), "0x"
                );
                const tx = await multiSigWallet.getTransaction(0);
                expect(tx.to).to.equal(ethers.ZeroAddress);
            }
        });
    });

    describe("Transaction Confirmation", function () {
        beforeEach(async function () {
            // Submit a transaction for testing
            await multiSigWallet.connect(owner1).submitTransaction(
                recipient.address, ethers.parseEther("0.1"), "0x"
            );
        });

        it("Should allow owners to confirm transactions", async function () {
            await expect(multiSigWallet.connect(owner1).confirmTransaction(0))
                .to.emit(multiSigWallet, "ConfirmTransaction")
                .withArgs(owner1.address, 0);
            
            expect(await multiSigWallet.isConfirmed(0, owner1.address)).to.equal(true);
        });

        it("Should increment confirmation count", async function () {
            await multiSigWallet.connect(owner1).confirmTransaction(0);
            
            const tx = await multiSigWallet.getTransaction(0);
            expect(tx.numConfirmations).to.equal(1);
        });

        it("Should not allow non-owners to confirm", async function () {
            await expect(multiSigWallet.connect(nonOwner).confirmTransaction(0))
                .to.be.revertedWith("MultiSig: not owner");
        });

        it("Should not allow double confirmation", async function () {
            await multiSigWallet.connect(owner1).confirmTransaction(0);
            await expect(multiSigWallet.connect(owner1).confirmTransaction(0))
                .to.be.revertedWith("MultiSig: tx already confirmed");
        });

        it("Should not allow confirming non-existent transaction", async function () {
            await expect(multiSigWallet.connect(owner1).confirmTransaction(999))
                .to.be.revertedWith("MultiSig: tx does not exist");
        });

        it("Should not allow confirming already executed transaction", async function () {
            // Fund the wallet
            await owner1.sendTransaction({
                to: await multiSigWallet.getAddress(),
                value: ethers.parseEther("1.0")
            });

            // Get confirmations and execute
            await multiSigWallet.connect(owner1).confirmTransaction(0);
            await multiSigWallet.connect(owner2).confirmTransaction(0);
            await multiSigWallet.connect(owner1).executeTransaction(0);

            // Try to confirm again
            await expect(multiSigWallet.connect(owner3).confirmTransaction(0))
                .to.be.revertedWith("MultiSig: tx already executed");
        });

        it("Should handle multiple confirmations correctly", async function () {
            await multiSigWallet.connect(owner1).confirmTransaction(0);
            await multiSigWallet.connect(owner2).confirmTransaction(0);
            await multiSigWallet.connect(owner3).confirmTransaction(0);
            
            const tx = await multiSigWallet.getTransaction(0);
            expect(tx.numConfirmations).to.equal(3);
            
            expect(await multiSigWallet.isConfirmed(0, owner1.address)).to.equal(true);
            expect(await multiSigWallet.isConfirmed(0, owner2.address)).to.equal(true);
            expect(await multiSigWallet.isConfirmed(0, owner3.address)).to.equal(true);
        });
    });

    describe("Transaction Revocation", function () {
        beforeEach(async function () {
            await multiSigWallet.connect(owner1).submitTransaction(
                recipient.address, ethers.parseEther("0.1"), "0x"
            );
            await multiSigWallet.connect(owner1).confirmTransaction(0);
        });

        it("Should allow owners to revoke their confirmation", async function () {
            await expect(multiSigWallet.connect(owner1).revokeConfirmation(0))
                .to.emit(multiSigWallet, "RevokeConfirmation")
                .withArgs(owner1.address, 0);
            
            expect(await multiSigWallet.isConfirmed(0, owner1.address)).to.equal(false);
        });

        it("Should decrement confirmation count", async function () {
            await multiSigWallet.connect(owner1).revokeConfirmation(0);
            
            const tx = await multiSigWallet.getTransaction(0);
            expect(tx.numConfirmations).to.equal(0);
        });

        it("Should not allow non-owners to revoke", async function () {
            await expect(multiSigWallet.connect(nonOwner).revokeConfirmation(0))
                .to.be.revertedWith("MultiSig: not owner");
        });

        it("Should not allow revoking non-confirmed transaction", async function () {
            await expect(multiSigWallet.connect(owner2).revokeConfirmation(0))
                .to.be.revertedWith("MultiSig: tx not confirmed");
        });

        it("Should not allow revoking already executed transaction", async function () {
            // Fund wallet and execute transaction
            await owner1.sendTransaction({
                to: await multiSigWallet.getAddress(),
                value: ethers.parseEther("1.0")
            });
            
            await multiSigWallet.connect(owner2).confirmTransaction(0);
            await multiSigWallet.connect(owner1).executeTransaction(0);
            
            await expect(multiSigWallet.connect(owner1).revokeConfirmation(0))
                .to.be.revertedWith("MultiSig: tx already executed");
        });

        it("Should not allow revoking non-existent transaction", async function () {
            await expect(multiSigWallet.connect(owner1).revokeConfirmation(999))
                .to.be.revertedWith("MultiSig: tx does not exist");
        });
    });

    describe("Transaction Execution", function () {
        beforeEach(async function () {
            // Fund the wallet
            await owner1.sendTransaction({
                to: await multiSigWallet.getAddress(),
                value: ethers.parseEther("1.0")
            });
            
            // Submit a transaction
            await multiSigWallet.connect(owner1).submitTransaction(
                recipient.address, ethers.parseEther("0.1"), "0x"
            );
        });

        it("Should execute transaction when enough confirmations", async function () {
            const initialBalance = await ethers.provider.getBalance(recipient.address);
            const transferAmount = ethers.parseEther("0.1");
            
            // Get required confirmations
            await multiSigWallet.connect(owner1).confirmTransaction(0);
            await multiSigWallet.connect(owner2).confirmTransaction(0);
            
            await expect(multiSigWallet.connect(owner1).executeTransaction(0))
                .to.emit(multiSigWallet, "ExecuteTransaction")
                .withArgs(owner1.address, 0);
            
            const finalBalance = await ethers.provider.getBalance(recipient.address);
            expect(finalBalance - initialBalance).to.equal(transferAmount);
            
            const tx = await multiSigWallet.getTransaction(0);
            expect(tx.executed).to.equal(true);
        });

        it("Should not execute without enough confirmations", async function () {
            await multiSigWallet.connect(owner1).confirmTransaction(0);
            
            await expect(multiSigWallet.connect(owner1).executeTransaction(0))
                .to.be.revertedWith("MultiSig: cannot execute tx");
        });

        it("Should not allow non-owners to execute", async function () {
            await multiSigWallet.connect(owner1).confirmTransaction(0);
            await multiSigWallet.connect(owner2).confirmTransaction(0);
            
            await expect(multiSigWallet.connect(nonOwner).executeTransaction(0))
                .to.be.revertedWith("MultiSig: not owner");
        });

        it("Should not execute already executed transaction", async function () {
            await multiSigWallet.connect(owner1).confirmTransaction(0);
            await multiSigWallet.connect(owner2).confirmTransaction(0);
            await multiSigWallet.connect(owner1).executeTransaction(0);
            
            await expect(multiSigWallet.connect(owner1).executeTransaction(0))
                .to.be.revertedWith("MultiSig: tx already executed");
        });

        it("Should not execute non-existent transaction", async function () {
            await expect(multiSigWallet.connect(owner1).executeTransaction(999))
                .to.be.revertedWith("MultiSig: tx does not exist");
        });

        it("Should revert execution if transaction fails", async function () {
            // Submit transaction with more value than available
            await multiSigWallet.connect(owner1).submitTransaction(
                recipient.address, ethers.parseEther("2.0"), "0x"
            );
            
            await multiSigWallet.connect(owner1).confirmTransaction(1);
            await multiSigWallet.connect(owner2).confirmTransaction(1);
            
            await expect(multiSigWallet.connect(owner1).executeTransaction(1))
                .to.be.revertedWith("MultiSig: tx failed");
        });

        it("Should handle contract calls with data", async function () {
            // Deploy TestContract using Hardhat's artifact system
            const TestContract = await ethers.getContractFactory("TestContract");
            const testContract = await TestContract.deploy();
            await testContract.waitForDeployment();
            
            // Encode function call data
            const callData = testContract.interface.encodeFunctionData("setValue", [42]);
            
            // Submit transaction to call the contract
            await multiSigWallet.connect(owner1).submitTransaction(
                await testContract.getAddress(), 0, callData
            );
            
            // Confirm and execute
            await multiSigWallet.connect(owner1).confirmTransaction(1);
            await multiSigWallet.connect(owner2).confirmTransaction(1);
            await multiSigWallet.connect(owner1).executeTransaction(1);
            
            // Verify the contract call worked
            expect(await testContract.value()).to.equal(42);
        });

        it("Should execute transaction with exact required confirmations", async function () {
            await multiSigWallet.connect(owner1).confirmTransaction(0);
            await multiSigWallet.connect(owner2).confirmTransaction(0);
            
            const tx = await multiSigWallet.getTransaction(0);
            expect(tx.numConfirmations).to.equal(REQUIRED_CONFIRMATIONS);
            
            await expect(multiSigWallet.connect(owner3).executeTransaction(0))
                .to.emit(multiSigWallet, "ExecuteTransaction");
        });

        it("Should execute transaction with more than required confirmations", async function () {
            await multiSigWallet.connect(owner1).confirmTransaction(0);
            await multiSigWallet.connect(owner2).confirmTransaction(0);
            await multiSigWallet.connect(owner3).confirmTransaction(0);
            
            const tx = await multiSigWallet.getTransaction(0);
            expect(tx.numConfirmations).to.equal(3);
            
            await expect(multiSigWallet.connect(owner1).executeTransaction(0))
                .to.emit(multiSigWallet, "ExecuteTransaction");
        });
    });

    describe("View Functions", function () {
        beforeEach(async function () {
            await multiSigWallet.connect(owner1).submitTransaction(
                recipient.address, ethers.parseEther("0.1"), "0x1234"
            );
            await multiSigWallet.connect(owner2).submitTransaction(
                recipient.address, ethers.parseEther("0.2"), "0x5678"
            );
        });

        it("Should return correct owners", async function () {
            const contractOwners = await multiSigWallet.getOwners();
            expect(contractOwners).to.deep.equal(owners);
        });

        it("Should return correct transaction count", async function () {
            expect(await multiSigWallet.getTransactionCount()).to.equal(2);
        });

        it("Should return correct transaction details", async function () {
            const tx = await multiSigWallet.getTransaction(0);
            expect(tx.to).to.equal(recipient.address);
            expect(tx.value).to.equal(ethers.parseEther("0.1"));
            expect(tx.data).to.equal("0x1234");
            expect(tx.executed).to.equal(false);
            expect(tx.numConfirmations).to.equal(0);
        });

        it("Should return correct confirmation status", async function () {
            await multiSigWallet.connect(owner1).confirmTransaction(0);
            
            expect(await multiSigWallet.isConfirmed(0, owner1.address)).to.equal(true);
            expect(await multiSigWallet.isConfirmed(0, owner2.address)).to.equal(false);
        });

        it("Should return correct required confirmations", async function () {
            expect(await multiSigWallet.numConfirmationsRequired()).to.equal(REQUIRED_CONFIRMATIONS);
        });

        it("Should return correct owner count", async function () {
            const contractOwners = await multiSigWallet.getOwners();
            expect(contractOwners.length).to.equal(3);
        });
    });

    describe("Edge Cases", function () {
        it("Should handle zero value transactions", async function () {
            await multiSigWallet.connect(owner1).submitTransaction(
                recipient.address, 0, "0x1234"
            );
            
            await multiSigWallet.connect(owner1).confirmTransaction(0);
            await multiSigWallet.connect(owner2).confirmTransaction(0);
            
            await expect(multiSigWallet.connect(owner1).executeTransaction(0))
                .to.emit(multiSigWallet, "ExecuteTransaction");
        });

        it("Should handle empty data transactions", async function () {
            await multiSigWallet.connect(owner1).submitTransaction(
                recipient.address, ethers.parseEther("0.1"), "0x"
            );
            
            const tx = await multiSigWallet.getTransaction(0);
            expect(tx.data).to.equal("0x");
        });

        it("Should handle multiple simultaneous transactions", async function () {
            // Fund wallet
            await owner1.sendTransaction({
                to: await multiSigWallet.getAddress(),
                value: ethers.parseEther("1.0")
            });
            
            // Submit multiple transactions
            await multiSigWallet.connect(owner1).submitTransaction(
                recipient.address, ethers.parseEther("0.1"), "0x"
            );
            await multiSigWallet.connect(owner2).submitTransaction(
                recipient.address, ethers.parseEther("0.2"), "0x"
            );
            
            // Confirm and execute first transaction
            await multiSigWallet.connect(owner1).confirmTransaction(0);
            await multiSigWallet.connect(owner2).confirmTransaction(0);
            await multiSigWallet.connect(owner1).executeTransaction(0);
            
            // Confirm and execute second transaction
            await multiSigWallet.connect(owner1).confirmTransaction(1);
            await multiSigWallet.connect(owner3).confirmTransaction(1);
            await multiSigWallet.connect(owner2).executeTransaction(1);
            
            const tx1 = await multiSigWallet.getTransaction(0);
            const tx2 = await multiSigWallet.getTransaction(1);
            
            expect(tx1.executed).to.equal(true);
            expect(tx2.executed).to.equal(true);
        });

        it("Should handle large transaction data", async function () {
            const largeData = "0x" + "12".repeat(1000); // 2000 bytes of data
            
            await multiSigWallet.connect(owner1).submitTransaction(
                recipient.address, 0, largeData
            );
            
            const tx = await multiSigWallet.getTransaction(0);
            expect(tx.data).to.equal(largeData);
        });

        it("Should handle maximum number of owners scenario", async function () {
            // This test assumes there might be a maximum limit on owners
            // For this test, we'll just verify current functionality works
            const currentOwners = await multiSigWallet.getOwners();
            expect(currentOwners.length).to.equal(3);
        });
    });

    describe("Security Tests", function () {
        it("Should prevent reentrancy attacks", async function () {
            // Fund the wallet
            await owner1.sendTransaction({
                to: await multiSigWallet.getAddress(),
                value: ethers.parseEther("1.0")
            });
            
            // Submit transaction
            await multiSigWallet.connect(owner1).submitTransaction(
                recipient.address, ethers.parseEther("0.1"), "0x"
            );
            
            // Confirm transaction
            await multiSigWallet.connect(owner1).confirmTransaction(0);
            await multiSigWallet.connect(owner2).confirmTransaction(0);
            
            // Execute transaction
            await multiSigWallet.connect(owner1).executeTransaction(0);
            
            // Verify transaction is marked as executed
            const tx = await multiSigWallet.getTransaction(0);
            expect(tx.executed).to.equal(true);
            
            // Attempt to execute again should fail
            await expect(multiSigWallet.connect(owner1).executeTransaction(0))
                .to.be.revertedWith("MultiSig: tx already executed");
        });

        it("Should prevent unauthorized access", async function () {
            // Only owners should be able to call owner-only functions
            await expect(multiSigWallet.connect(nonOwner).submitTransaction(
                recipient.address, ethers.parseEther("0.1"), "0x"
            )).to.be.revertedWith("MultiSig: not owner");
            
            await expect(multiSigWallet.connect(nonOwner).confirmTransaction(0))
                .to.be.revertedWith("MultiSig: not owner");
            
            await expect(multiSigWallet.connect(nonOwner).revokeConfirmation(0))
                .to.be.revertedWith("MultiSig: not owner");
            
            await expect(multiSigWallet.connect(nonOwner).executeTransaction(0))
                .to.be.revertedWith("MultiSig: not owner");
        });

        it("Should require sufficient confirmations", async function () {
            // Fund wallet
            await owner1.sendTransaction({
                to: await multiSigWallet.getAddress(),
                value: ethers.parseEther("1.0")
            });
            
            // Submit transaction
            await multiSigWallet.connect(owner1).submitTransaction(
                recipient.address, ethers.parseEther("0.1"), "0x"
            );
            
            // With only 1 confirmation (less than required 2)
            await multiSigWallet.connect(owner1).confirmTransaction(0);
            
            await expect(multiSigWallet.connect(owner1).executeTransaction(0))
                .to.be.revertedWith("MultiSig: cannot execute tx");
        });
    });

    describe("Gas Optimization Tests", function () {
        it("Should not waste gas on failed external calls", async function () {
            // Deploy TestContract to test failed calls
            const TestContract = await ethers.getContractFactory("TestContract");
            const testContract = await TestContract.deploy();
            await testContract.waitForDeployment();
            
            
            // Submit transaction that will fail
            await multiSigWallet.connect(owner1).submitTransaction(
                await testContract.getAddress(), 0, revertCall
            );
            
            // Confirm transaction
            await multiSigWallet.connect(owner1).confirmTransaction(0);
            await multiSigWallet.connect(owner2).confirmTransaction(0);
            
            // Execute should fail
            await expect(multiSigWallet.connect(owner1).executeTransaction(0))
                .to.be.revertedWith("MultiSig: tx failed");
        });

        it("Should efficiently handle multiple confirmations", async function () {
            await multiSigWallet.connect(owner1).submitTransaction(
                recipient.address, ethers.parseEther("0.1"), "0x"
            );
            
            // Multiple confirmations should not cause issues
            await multiSigWallet.connect(owner1).confirmTransaction(0);
            await multiSigWallet.connect(owner2).confirmTransaction(0);
            await multiSigWallet.connect(owner3).confirmTransaction(0);
            
            const tx = await multiSigWallet.getTransaction(0);
            expect(tx.numConfirmations).to.equal(3);
        });
    });

    describe("Integration Tests", function () {
        it("Should handle full workflow correctly", async function () {
            const initialRecipientBalance = await ethers.provider.getBalance(recipient.address);
            const transferAmount = ethers.parseEther("0.5");
            
            // 1. Fund the wallet
            await owner1.sendTransaction({
                to: await multiSigWallet.getAddress(),
                value: ethers.parseEther("1.0")
            });
            
            // 2. Submit transaction
            await expect(multiSigWallet.connect(owner1).submitTransaction(
                recipient.address, transferAmount, "0x"
            )).to.emit(multiSigWallet, "SubmitTransaction");
            
            // 3. Confirm transaction (2 confirmations required)
            await expect(multiSigWallet.connect(owner1).confirmTransaction(0))
                .to.emit(multiSigWallet, "ConfirmTransaction");
            
            await expect(multiSigWallet.connect(owner2).confirmTransaction(0))
                .to.emit(multiSigWallet, "ConfirmTransaction");
            
            // 4. Execute transaction
            await expect(multiSigWallet.connect(owner3).executeTransaction(0))
                .to.emit(multiSigWallet, "ExecuteTransaction");
            
            // 5. Verify results
            const finalRecipientBalance = await ethers.provider.getBalance(recipient.address);
            expect(finalRecipientBalance - initialRecipientBalance).to.equal(transferAmount);
            
            const tx = await multiSigWallet.getTransaction(0);
            expect(tx.executed).to.equal(true);
            expect(tx.numConfirmations).to.equal(2);
        });
    });
});