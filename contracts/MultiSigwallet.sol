// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

/**
 * @title MultiSigWallet
 * @dev Multi-signature wallet for secure governance operations
 * @notice This contract allows multiple owners to approve transactions before execution
 */
contract MultiSigWallet {
    // Events
    event Deposit(address indexed sender, uint256 amount, uint256 balance);
    event SubmitTransaction(
        address indexed owner,
        uint256 indexed txIndex,
        address indexed to,
        uint256 value,
        bytes data
    );
    event ConfirmTransaction(address indexed owner, uint256 indexed txIndex);
    event RevokeConfirmation(address indexed owner, uint256 indexed txIndex);
    event ExecuteTransaction(address indexed owner, uint256 indexed txIndex);
    event OwnerAddition(address indexed owner);
    event OwnerRemoval(address indexed owner);
    event RequirementChange(uint256 required);

    // State variables
    address[] public owners;
    mapping(address => bool) public isOwner;
    uint256 public numConfirmationsRequired;

    struct Transaction {
        address to;
        uint256 value;
        bytes data;
        bool executed;
        uint256 numConfirmations;
    }

    // Mapping from tx index => owner => bool
    mapping(uint256 => mapping(address => bool)) public isConfirmed;
    Transaction[] public transactions;

    // Modifiers
    modifier onlyOwner() {
        require(isOwner[msg.sender], "MultiSig: not owner");
        _;
    }

    modifier txExists(uint256 _txIndex) {
        require(_txIndex < transactions.length, "MultiSig: tx does not exist");
        _;
    }

    modifier notExecuted(uint256 _txIndex) {
        require(!transactions[_txIndex].executed, "MultiSig: tx already executed");
        _;
    }

    modifier notConfirmed(uint256 _txIndex) {
        require(!isConfirmed[_txIndex][msg.sender], "MultiSig: tx already confirmed");
        _;
    }

    /**
     * @dev Constructor sets initial owners and required number of confirmations
     * @param _owners List of initial owners
     * @param _numConfirmationsRequired Number of required confirmations
     */
    constructor(address[] memory _owners, uint256 _numConfirmationsRequired) {
        require(_owners.length > 0, "MultiSig: owners required");
        require(
            _numConfirmationsRequired > 0 &&
                _numConfirmationsRequired <= _owners.length,
            "MultiSig: invalid number of required confirmations"
        );

        for (uint256 i = 0; i < _owners.length; i++) {
            address owner = _owners[i];

            require(owner != address(0), "MultiSig: invalid owner");
            require(!isOwner[owner], "MultiSig: owner not unique");

            isOwner[owner] = true;
            owners.push(owner);
        }

        numConfirmationsRequired = _numConfirmationsRequired;
    }

    /**
     * @dev Allows contract to receive Ether
     */
    receive() external payable {
        emit Deposit(msg.sender, msg.value, address(this).balance);
    }

    /**
     * @dev Submit a transaction for approval
     * @param _to Destination address
     * @param _value Ether value to send
     * @param _data Transaction data
     */
    function submitTransaction(
        address _to,
        uint256 _value,
        bytes memory _data
    ) public onlyOwner {
        uint256 txIndex = transactions.length;

        transactions.push(
            Transaction({
                to: _to,
                value: _value,
                data: _data,
                executed: false,
                numConfirmations: 0
            })
        );

        emit SubmitTransaction(msg.sender, txIndex, _to, _value, _data);
    }

    /**
     * @dev Confirm a transaction
     * @param _txIndex Transaction index
     */
    function confirmTransaction(uint256 _txIndex)
        public
        onlyOwner
        txExists(_txIndex)
        notExecuted(_txIndex)
        notConfirmed(_txIndex)
    {
        Transaction storage transaction = transactions[_txIndex];
        transaction.numConfirmations += 1;
        isConfirmed[_txIndex][msg.sender] = true;

        emit ConfirmTransaction(msg.sender, _txIndex);
    }

    /**
     * @dev Execute a confirmed transaction
     * @param _txIndex Transaction index
     */
    function executeTransaction(uint256 _txIndex)
        public
        onlyOwner
        txExists(_txIndex)
        notExecuted(_txIndex)
    {
        Transaction storage transaction = transactions[_txIndex];

        require(
            transaction.numConfirmations >= numConfirmationsRequired,
            "MultiSig: cannot execute tx"
        );

        transaction.executed = true;

        (bool success, ) = transaction.to.call{value: transaction.value}(
            transaction.data
        );
        require(success, "MultiSig: tx failed");

        emit ExecuteTransaction(msg.sender, _txIndex);
    }

    /**
     * @dev Revoke confirmation for a transaction
     * @param _txIndex Transaction index
     */
    function revokeConfirmation(uint256 _txIndex)
        public
        onlyOwner
        txExists(_txIndex)
        notExecuted(_txIndex)
    {
        require(isConfirmed[_txIndex][msg.sender], "MultiSig: tx not confirmed");

        Transaction storage transaction = transactions[_txIndex];
        transaction.numConfirmations -= 1;
        isConfirmed[_txIndex][msg.sender] = false;

        emit RevokeConfirmation(msg.sender, _txIndex);
    }

    /**
     * @dev Add a new owner (requires multi-sig approval)
     * @param owner Address of new owner
     */
    function addOwner(address owner) public onlyOwner {
        require(owner != address(0), "MultiSig: invalid owner");
        require(!isOwner[owner], "MultiSig: owner exists");

        isOwner[owner] = true;
        owners.push(owner);

        emit OwnerAddition(owner);
    }

    /**
     * @dev Remove an owner (requires multi-sig approval)
     * @param owner Address of owner to remove
     */
    function removeOwner(address owner) public onlyOwner {
        require(isOwner[owner], "MultiSig: not an owner");
        require(owners.length > numConfirmationsRequired, "MultiSig: cannot remove owner");

        isOwner[owner] = false;
        
        for (uint256 i = 0; i < owners.length - 1; i++) {
            if (owners[i] == owner) {
                owners[i] = owners[owners.length - 1];
                break;
            }
        }
        owners.pop();

        emit OwnerRemoval(owner);
    }

    /**
     * @dev Change the number of required confirmations
     * @param _required New number of required confirmations
     */
    function changeRequirement(uint256 _required) public onlyOwner {
        require(
            _required > 0 && _required <= owners.length,
            "MultiSig: invalid requirement"
        );
        
        numConfirmationsRequired = _required;
        emit RequirementChange(_required);
    }

    // View functions
    function getOwners() public view returns (address[] memory) {
        return owners;
    }

    function getTransactionCount() public view returns (uint256) {
        return transactions.length;
    }

    function getTransaction(uint256 _txIndex)
        public
        view
        returns (
            address to,
            uint256 value,
            bytes memory data,
            bool executed,
            uint256 numConfirmations
        )
    {
        Transaction storage transaction = transactions[_txIndex];

        return (
            transaction.to,
            transaction.value,
            transaction.data,
            transaction.executed,
            transaction.numConfirmations
        );
    }
}