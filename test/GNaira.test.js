const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("GNaira Token", function () {
    let gNaira;
    let governor, user1, user2, user3, blacklistedUser;
    
    beforeEach(async function () {
        // Get signers
        [governor, user1, user2, user3, blacklistedUser] = await ethers.getSigners();
        
        // Deploy GNaira contract
        const GNaira = await ethers.getContractFactory("GNaira");
        gNaira = await GNaira.deploy(governor.address);
        await gNaira.waitForDeployment();
        
    });

    describe("Deployment", function () {
        it("Should set the correct token metadata", async function () {
            expect(await gNaira.name()).to.equal("G-Naira");
            expect(await gNaira.symbol()).to.equal("gNGN");
            expect(await gNaira.decimals()).to.equal(18);
        });

        it("Should set the correct initial governor", async function () {
            expect(await gNaira.governor()).to.equal(governor.address);
        });

        it("Should have zero initial supply", async function () {
            expect(await gNaira.totalSupply()).to.equal(0);
        });

        it("Should not be paused initially", async function () {
            expect(await gNaira.isPaused()).to.equal(false);
        });
    });

    describe("Governor Role Management", function () {
        it("Should allow governor to transfer role", async function () {
            await gNaira.connect(governor).setGovernor(user1.address);
            expect(await gNaira.governor()).to.equal(user1.address);
        });

        it("Should emit GovernorChanged event", async function () {
            await expect(gNaira.connect(governor).setGovernor(user1.address))
                .to.emit(gNaira, "GovernorChanged")
                .withArgs(governor.address, user1.address);
        });

        it("Should not allow non-governor to transfer role", async function () {
            await expect(gNaira.connect(user1).setGovernor(user2.address))
                .to.be.revertedWith("GNaira: caller is not the governor");
        });

        it("Should not allow setting zero address as governor", async function () {
            await expect(gNaira.connect(governor).setGovernor(ethers.ZeroAddress))
                .to.be.revertedWith("GNaira: new governor is the zero address");
        });
    });

    describe("Minting", function () {
        it("Should allow governor to mint tokens", async function () {
            const mintAmount = ethers.parseEther("1000");
            
            await gNaira.connect(governor).mint(user1.address, mintAmount);
            
            expect(await gNaira.totalSupply()).to.equal(mintAmount);
            expect(await gNaira.balanceOf(user1.address)).to.equal(mintAmount);
        });

        it("Should emit Mint and Transfer events", async function () {
            const mintAmount = ethers.parseEther("500");
            
            await expect(gNaira.connect(governor).mint(user1.address, mintAmount))
                .to.emit(gNaira, "Mint")
                .withArgs(user1.address, mintAmount)
                .and.to.emit(gNaira, "Transfer")
                .withArgs(ethers.ZeroAddress, user1.address, mintAmount);
        });

        it("Should not allow non-governor to mint", async function () {
            const mintAmount = ethers.parseEther("100");
            
            await expect(gNaira.connect(user1).mint(user2.address, mintAmount))
                .to.be.revertedWith("GNaira: caller is not the governor");
        });

        it("Should not allow minting to zero address", async function () {
            const mintAmount = ethers.parseEther("100");
            
            await expect(gNaira.connect(governor).mint(ethers.ZeroAddress, mintAmount))
                .to.be.revertedWith("GNaira: mint to the zero address");
        });

        it("Should not allow minting to blacklisted address", async function () {
            const mintAmount = ethers.parseEther("100");
            
            // Blacklist user first
            await gNaira.connect(governor).blacklist(user1.address);
            
            await expect(gNaira.connect(governor).mint(user1.address, mintAmount))
                .to.be.revertedWith("GNaira: account is blacklisted");
        });
    });

    describe("Burning", function () {
        beforeEach(async function () {
            // Mint some tokens to governor for burning tests
            await gNaira.connect(governor).mint(governor.address, ethers.parseEther("1000"));
            await gNaira.connect(governor).mint(user1.address, ethers.parseEther("500"));
        });

        it("Should allow governor to burn own tokens", async function () {
            const burnAmount = ethers.parseEther("200");
            const initialBalance = await gNaira.balanceOf(governor.address);
            const initialSupply = await gNaira.totalSupply();
            
            await gNaira.connect(governor).burn(burnAmount);
            
            expect(await gNaira.balanceOf(governor.address)).to.equal(initialBalance - burnAmount);
            expect(await gNaira.totalSupply()).to.equal(initialSupply - burnAmount);
        });

        it("Should allow governor to burn from any account", async function () {
            const burnAmount = ethers.parseEther("100");
            const initialBalance = await gNaira.balanceOf(user1.address);
            const initialSupply = await gNaira.totalSupply();
            
            await gNaira.connect(governor).burnFrom(user1.address, burnAmount);
            
            expect(await gNaira.balanceOf(user1.address)).to.equal(initialBalance - burnAmount);
            expect(await gNaira.totalSupply()).to.equal(initialSupply - burnAmount);
        });

        it("Should emit Burn and Transfer events", async function () {
            const burnAmount = ethers.parseEther("100");
            
            await expect(gNaira.connect(governor).burn(burnAmount))
                .to.emit(gNaira, "Burn")
                .withArgs(governor.address, burnAmount)
                .and.to.emit(gNaira, "Transfer")
                .withArgs(governor.address, ethers.ZeroAddress, burnAmount);
        });

        it("Should not allow non-governor to burn", async function () {
            const burnAmount = ethers.parseEther("50");
            
            await expect(gNaira.connect(user1).burn(burnAmount))
                .to.be.revertedWith("GNaira: caller is not the governor");
        });

        it("Should not allow burning more than balance", async function () {
            const burnAmount = ethers.parseEther("2000"); // More than total supply
            
            await expect(gNaira.connect(governor).burn(burnAmount))
                .to.be.revertedWith("GNaira: burn amount exceeds balance");
        });
    });

    describe("Blacklisting", function () {
        it("Should allow governor to blacklist addresses", async function () {
            await gNaira.connect(governor).blacklist(user1.address);
            expect(await gNaira.isBlacklisted(user1.address)).to.equal(true);
        });

        it("Should allow governor to remove from blacklist", async function () {
            await gNaira.connect(governor).blacklist(user1.address);
            await gNaira.connect(governor).unBlacklist(user1.address);
            expect(await gNaira.isBlacklisted(user1.address)).to.equal(false);
        });

        it("Should emit Blacklisted and UnBlacklisted events", async function () {
            await expect(gNaira.connect(governor).blacklist(user1.address))
                .to.emit(gNaira, "Blacklisted")
                .withArgs(user1.address);
                
            await expect(gNaira.connect(governor).unBlacklist(user1.address))
                .to.emit(gNaira, "UnBlacklisted")
                .withArgs(user1.address);
        });

        it("Should not allow non-governor to blacklist", async function () {
            await expect(gNaira.connect(user1).blacklist(user2.address))
                .to.be.revertedWith("GNaira: caller is not the governor");
        });

        it("Should not allow blacklisting zero address", async function () {
            await expect(gNaira.connect(governor).blacklist(ethers.ZeroAddress))
                .to.be.revertedWith("GNaira: blacklist zero address");
        });

        it("Should not allow blacklisting already blacklisted address", async function () {
            await gNaira.connect(governor).blacklist(user1.address);
            await expect(gNaira.connect(governor).blacklist(user1.address))
                .to.be.revertedWith("GNaira: account already blacklisted");
        });
    });

    describe("Transfer Restrictions", function () {
        beforeEach(async function () {
            // Mint tokens for testing
            await gNaira.connect(governor).mint(user1.address, ethers.parseEther("1000"));
            await gNaira.connect(governor).mint(user2.address, ethers.parseEther("500"));
        });

        it("Should prevent blacklisted users from sending tokens", async function () {
            await gNaira.connect(governor).blacklist(user1.address);
            
            await expect(gNaira.connect(user1).transfer(user2.address, ethers.parseEther("100")))
                .to.be.revertedWith("GNaira: account is blacklisted");
        });

        it("Should prevent sending tokens to blacklisted users", async function () {
            await gNaira.connect(governor).blacklist(user2.address);
            
            await expect(gNaira.connect(user1).transfer(user2.address, ethers.parseEther("100")))
                .to.be.revertedWith("GNaira: account is blacklisted");
        });

        it("Should prevent transfers when paused", async function () {
            await gNaira.connect(governor).pause();
            
            await expect(gNaira.connect(user1).transfer(user2.address, ethers.parseEther("100")))
                .to.be.revertedWith("GNaira: token transfer while paused");
        });

        it("Should allow transfers when not paused and not blacklisted", async function () {
            const transferAmount = ethers.parseEther("100");
            
            await expect(gNaira.connect(user1).transfer(user2.address, transferAmount))
                .to.emit(gNaira, "Transfer")
                .withArgs(user1.address, user2.address, transferAmount);
        });
    });

    describe("Pause Functionality", function () {
        it("Should allow governor to pause contract", async function () {
            await gNaira.connect(governor).pause();
            expect(await gNaira.isPaused()).to.equal(true);
        });

        it("Should allow governor to unpause contract", async function () {
            await gNaira.connect(governor).pause();
            await gNaira.connect(governor).unpause();
            expect(await gNaira.isPaused()).to.equal(false);
        });

        it("Should emit Paused and Unpaused events", async function () {
            await expect(gNaira.connect(governor).pause())
                .to.emit(gNaira, "Paused")
                .withArgs(governor.address);
                
            await expect(gNaira.connect(governor).unpause())
                .to.emit(gNaira, "Unpaused")
                .withArgs(governor.address);
        });

        it("Should not allow non-governor to pause", async function () {
            await expect(gNaira.connect(user1).pause())
                .to.be.revertedWith("GNaira: caller is not the governor");
        });

        it("Should not allow pausing when already paused", async function () {
            await gNaira.connect(governor).pause();
            await expect(gNaira.connect(governor).pause())
                .to.be.revertedWith("GNaira: already paused");
        });

        it("Should not allow unpausing when not paused", async function () {
            await expect(gNaira.connect(governor).unpause())
                .to.be.revertedWith("GNaira: not paused");
        });
    });

    describe("ERC20 Standard Functions", function () {
        beforeEach(async function () {
            // Mint tokens for ERC20 testing
            await gNaira.connect(governor).mint(user1.address, ethers.parseEther("1000"));
            await gNaira.connect(governor).mint(user2.address, ethers.parseEther("500"));
        });

        it("Should handle approvals correctly", async function () {
            const approveAmount = ethers.parseEther("200");
            
            await gNaira.connect(user1).approve(user2.address, approveAmount);
            expect(await gNaira.allowance(user1.address, user2.address)).to.equal(approveAmount);
        });

        it("Should handle transferFrom correctly", async function () {
            const approveAmount = ethers.parseEther("200");
            const transferAmount = ethers.parseEther("100");
            
            await gNaira.connect(user1).approve(user2.address, approveAmount);
            await gNaira.connect(user2).transferFrom(user1.address, user3.address, transferAmount);
            
            expect(await gNaira.balanceOf(user3.address)).to.equal(transferAmount);
            expect(await gNaira.allowance(user1.address, user2.address)).to.equal(approveAmount - transferAmount);
        });

        it("Should not allow transferFrom without sufficient allowance", async function () {
            const transferAmount = ethers.parseEther("100");
            
            await expect(gNaira.connect(user2).transferFrom(user1.address, user3.address, transferAmount))
                .to.be.revertedWith("GNaira: insufficient allowance");
        });

        it("Should not allow transfers with insufficient balance", async function () {
            const transferAmount = ethers.parseEther("2000"); // More than balance
            
            await expect(gNaira.connect(user1).transfer(user2.address, transferAmount))
                .to.be.revertedWith("GNaira: transfer amount exceeds balance");
        });
    });
});