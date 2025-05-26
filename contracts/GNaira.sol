// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

interface IERC20 {
    event Transfer(address indexed from, address indexed to, uint256 value);

    /**
     * @dev Emitted when the allowance of a `spender` for an `owner` is set by
     * a call to {approve}. `value` is the new allowance.
     */
    event Approval(address indexed owner, address indexed spender, uint256 value);

    /**
     * @dev Returns the amount of tokens in existence.
     */
    function totalSupply() external view returns (uint256);

    /** 
     *  Returns the amount of tokens owned by `account`*/
    function balanceOf(address account) external view returns (uint256);

    /**
     * @dev Moves `amount` tokens from the caller's account to `to`.
     *
     * Returns a boolean value indicating whether the operation succeeded.
     *
     * Emits a {Transfer} event.
     */
    function transfer(address to, uint256 amount) external returns (bool);

    /**
     * @dev Returns the remaining number of tokens that "spender" will be
     * allowed to spend on behalf of "owner" through {transferFrom}. This is
     * zero by default.
     *
     * This value changes when {approve} or {transferFrom} are called.
     */
    function allowance(address owner, address spender) external view returns (uint256);

    /**
      @dev Sets `amount` as the allowance of `spender` over the caller's tokens.Returns a boolean value indicating whether the operation succeeded. Emits an {Approval} event.
     */
    function approve(address spender, uint256 amount) external returns (bool);

    /*
      @dev Moves "amount" tokens from "from" to "to" using the
      allowance mechanism. `amount` is then deducted from the caller's
      allowance. Returns a boolean value indicating whether the operation succeeded.
      Emits a {Transfer} event.
     */
    function transferFrom(address from, address to, uint256 amount) external returns (bool);
}

/**
 * @title GNaira
 * @dev Central Bank Digital Currency (CBDC) for Nigeria
 * @notice This contract implements G-Naira with governance, minting, burning, and blacklisting features
 */
contract GNaira is IERC20 {
    // Token metadata
    string public constant name = "G-Naira";
    string public constant symbol = "gNGN";
    uint8 public constant decimals = 18;
    
    // State variables
    uint256 private _totalSupply;
    address public governor;
    bool public paused;

    // Mappings
    mapping(address => uint256) private _balances;
    mapping(address => mapping(address => uint256)) private _allowances;
    mapping(address => bool) public blacklisted;

    // Events
    event GovernorChanged(address indexed previousGovernor, address indexed newGovernor);
    event Mint(address indexed to, uint256 amount);
    event Burn(address indexed from, uint256 amount);
    event Blacklisted(address indexed account);
    event UnBlacklisted(address indexed account);
    event Paused(address indexed account);
    event Unpaused(address indexed account);

    // Modifiers
    modifier onlyGovernor() {
        require(msg.sender == governor, "GNaira: caller is not the governor");
        _;
    }

    modifier whenNotPaused() {
        require(!paused, "GNaira: token transfer while paused");
        _;
    }

    modifier notBlacklisted(address account) {
        require(!blacklisted[account], "GNaira: account is blacklisted");
        _;
    }

    /**
     * @dev Constructor that sets the initial governor
     * @param _governor Address of the initial governor
     */
    constructor(address _governor) {
        require(_governor != address(0), "GNaira: governor is the zero address");
        governor = _governor;
        emit GovernorChanged(address(0), _governor);
    }

    // ERC20 Implementation
    
    /**
     * @dev Returns the total amount of tokens in existence
     */
    function totalSupply() public view override returns (uint256) {
        return _totalSupply;
    }

    /**
     * @dev Returns the amount of tokens owned by account
     */
    function balanceOf(address account) public view override returns (uint256) {
        return _balances[account];
    }

    /**
     * @dev Moves amount tokens from the caller's account to to
     * Necessary checks:
     *  to cannot be the zero address
     *  the caller must have a balance of at least amount
     *  neither sender nor receiver can be blacklisted
     *  contract must not be paused
     */
    function transfer(address to, uint256 amount) 
        public 
        override 
        whenNotPaused 
        notBlacklisted(msg.sender) 
        notBlacklisted(to) 
        returns (bool) 
    {
        address owner = msg.sender;
        _transfer(owner, to, amount);
        return true;
    }

    /**
     * @dev Returns the remaining number of tokens that spender will be allowed to spend on behalf of owner
     */
    function allowance(address owner, address spender) public view override returns (uint256) {
        return _allowances[owner][spender];
    }

    /**
     * @dev Sets amount as the allowance of spender over the caller's tokens
     */
    function approve(address spender, uint256 amount) 
        public 
        override 
        whenNotPaused 
        notBlacklisted(msg.sender) 
        notBlacklisted(spender) 
        returns (bool) 
    {
        address owner = msg.sender;
        _approve(owner, spender, amount);
        return true;
    }

    /**
     * @dev Moves amount tokens from from to to using the allowance mechanism
     */
    function transferFrom(address from, address to, uint256 amount) 
        public 
        override 
        whenNotPaused 
        notBlacklisted(msg.sender) 
        notBlacklisted(from) 
        notBlacklisted(to) 
        returns (bool) 
    {
        address spender = msg.sender;
        _spendAllowance(from, spender, amount);
        _transfer(from, to, amount);
        return true;
    }

    // Governor Functions

    /**
     * @dev Mints amount tokens to to address
     * @param to Address to mint tokens to
     * @param amount Amount of tokens to mint
     * Requirements:
     * - caller must be the governor
     * - to cannot be the zero address
     * - to cannot be blacklisted
     */
    function mint(address to, uint256 amount) 
        public 
        onlyGovernor 
        notBlacklisted(to) 
    {
        require(to != address(0), "GNaira: mint to the zero address");
        
        _totalSupply += amount;
        unchecked {
            _balances[to] += amount;
        }
        
        emit Transfer(address(0), to, amount);
        emit Mint(to, amount);
    }

    /**
     * @dev Burns amount tokens from the caller's account
     * @param amount Amount of tokens to burn
     * Requirements:
     * - caller must be the governor
     * - governor must have at least amount tokens
     */
    function burn(uint256 amount) public onlyGovernor {
        _burn(msg.sender, amount);
    }

    /**
     * @dev Burns amount tokens from account, deducting from the caller's allowance
     * @param account Account to burn tokens from
     * @param amount Amount of tokens to burn
     * Requirements:
     * - caller must be the governor
     * - account cannot be the zero address
     * - account must have at least amount tokens
     */
    function burnFrom(address account, uint256 amount) public onlyGovernor {
        require(account != address(0), "GNaira: burn from the zero address");
        _burn(account, amount);
    }

    /**
     * @dev Adds an address to the blacklist
     * @param account Address to blacklist
     * Requirements:
     * - caller must be the governor
     * - account cannot be the zero address
     * - account must not already be blacklisted
     */
    function blacklist(address account) public onlyGovernor {
        require(account != address(0), "GNaira: blacklist zero address");
        require(!blacklisted[account], "GNaira: account already blacklisted");
        
        blacklisted[account] = true;
        emit Blacklisted(account);
    }

    /**
     * @dev Removes an address from the blacklist
     * @param account Address to remove from blacklist
     * Requirements:
     * - caller must be the governor
     * - account must be currently blacklisted
     */
    function unBlacklist(address account) public onlyGovernor {
        require(blacklisted[account], "GNaira: account not blacklisted");
        
        blacklisted[account] = false;
        emit UnBlacklisted(account);
    }

    /**
     * @dev Pauses all token transfers
     * Requirements:
     * - caller must be the governor
     * - contract must not already be paused
     */
    function pause() public onlyGovernor {
        require(!paused, "GNaira: already paused");
        paused = true;
        emit Paused(msg.sender);
    }

    /**
     * @dev Unpauses all token transfers
     * Requirements:
     * - caller must be the governor
     * - contract must be currently paused
     */
    function unpause() public onlyGovernor {
        require(paused, "GNaira: not paused");
        paused = false;
        emit Unpaused(msg.sender);
    }

    /**
     * @dev Transfers governor role to a new account
     * @param newGovernor Address of the new governor
     * Requirements:
     * - caller must be the current governor
     * - newGovernor cannot be the zero address
     * - newGovernor cannot be blacklisted
     */
    function setGovernor(address newGovernor) 
        public 
        onlyGovernor 
        notBlacklisted(newGovernor) 
    {
        require(newGovernor != address(0), "GNaira: new governor is the zero address");
        require(newGovernor != governor, "GNaira: new governor is the same as current governor");
        
        address previousGovernor = governor;
        governor = newGovernor;
        emit GovernorChanged(previousGovernor, newGovernor);
    }

    // View Functions

    /**
     * @dev Returns whether an account is blacklisted
     * @param account Address to check
     * @return bool indicating if account is blacklisted
     */
    function isBlacklisted(address account) public view returns (bool) {
        return blacklisted[account];
    }

    /**
     * @dev Returns whether the contract is paused
     * @return bool indicating if contract is paused
     */
    function isPaused() public view returns (bool) {
        return paused;
    }

    // Internal Functions

    /**
     * @dev Moves amount of tokens from from to to
     */
    function _transfer(address from, address to, uint256 amount) internal {
        require(from != address(0), "GNaira: transfer from the zero address");
        require(to != address(0), "GNaira: transfer to the zero address");

        uint256 fromBalance = _balances[from];
        require(fromBalance >= amount, "GNaira: transfer amount exceeds balance");
        
        unchecked {
            _balances[from] = fromBalance - amount;
            _balances[to] += amount;
        }

        emit Transfer(from, to, amount);
    }

    /**
     * @dev Sets amount as the allowance of spender over the owner's tokens
     */
    function _approve(address owner, address spender, uint256 amount) internal {
        require(owner != address(0), "GNaira: approve from the zero address");
        require(spender != address(0), "GNaira: approve to the zero address");

        _allowances[owner][spender] = amount;
        emit Approval(owner, spender, amount);
    }

    /**
     * @dev Updates owner's allowance for spender based on spent amount
     */
    function _spendAllowance(address owner, address spender, uint256 amount) internal {
        uint256 currentAllowance = allowance(owner, spender);
        if (currentAllowance != type(uint256).max) {
            require(currentAllowance >= amount, "GNaira: insufficient allowance");
            unchecked {
                _approve(owner, spender, currentAllowance - amount);
            }
        }
    }

    /**
     * @dev Destroys amount tokens from account, reducing the total supply
     */
    function _burn(address account, uint256 amount) internal {
        require(account != address(0), "GNaira: burn from the zero address");

        uint256 accountBalance = _balances[account];
        require(accountBalance >= amount, "GNaira: burn amount exceeds balance");
        
        unchecked {
            _balances[account] = accountBalance - amount;
            _totalSupply -= amount;
        }

        emit Transfer(account, address(0), amount);
        emit Burn(account, amount);
    }
}