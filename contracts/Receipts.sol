pragma solidity 0.6.12;

contract Receipts {
    struct Receipt {
        address asset;
        address owner;
        string targetAddress;
        uint256 amount;
        uint256 startTime;
        uint256 endTime;
        bool finished;
    }

    uint256 public receiptCount = 0;
    Receipt[] public receipts;
}
