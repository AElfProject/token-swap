pragma solidity 0.6.12;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/token/ERC20/SafeERC20.sol";
import "@openzeppelin/contracts/math/SafeMath.sol";
import "./Receipts.sol";

contract LockMapping is Ownable, Receipts {
    using SafeMath for uint256;
    using SafeERC20 for ERC20;

    event NewReceipt(uint256 receiptId, address asset, address owner, uint256 amount, uint256 endTime, string invitingCode);
    event ReceiptFinished(uint256 receiptId, address asset, address owner, uint256 amount, uint256 finishTime);

    address public asset;
	ERC20 token;
    uint256 public lockTime;

    mapping(address => uint256[]) public ownerToReceipts;

	constructor (ERC20 _token, uint256 _lockTime) public{
		asset = address(_token);
		token = _token;
        lockTime = _lockTime;
	}

	function _createReceipt(
        address _asset,
        address _owner,
        string calldata _targetAddress,
        uint256 _amount,
        uint256 _startTime,
        uint256 _endTime,
        bool _finished,
        string calldata _code
    ) internal {
        receipts.push(Receipt(_asset, _owner, _targetAddress, _amount, _startTime, _endTime, _finished));
        totalAmountInReceipts = totalAmountInReceipts.add(_amount);
        receiptCount = receipts.length;
        uint256 id = receiptCount.sub(1);
        ownerToReceipts[msg.sender].push(id);
        emit NewReceipt(id, _asset, _owner, _amount, _endTime, _code);
    }


    //create new receipt
    function createReceipt(uint256 _amount, string calldata _targetAddress, string calldata _code) external {
        //deposit token to this contract
        token.safeTransferFrom(msg.sender, address(this), _amount);
        _createReceipt(asset, msg.sender, _targetAddress, _amount, now, now.add(lockTime), false, _code);
    }

    //finish the receipt and withdraw bonus and token
    function finishReceipt(uint256 _id) external {
        // only receipt owner can finish receipt
        Receipt memory receipt = receipts[_id];
        require(msg.sender == receipt.owner, "[LOCK]Not receipt owner.");
        // exceeding time period
        require(receipt.endTime != 0 && receipt.endTime <= now, "[LOCK]Unable to finish receipt before endtime.");
        // not yet finished
        require(receipt.finished == false, "[LOCK]Already finished.");

        token.safeTransfer(receipt.owner, receipt.amount);
        totalAmountInReceipts = totalAmountInReceipts.sub(receipt.amount);
        receipts[_id].finished = true;
        emit ReceiptFinished(_id, asset, receipt.owner, receipt.amount, now);
    }

    function getMyReceipts(address _address) external view returns (uint256[] memory){
        uint256[] memory receipt_ids = ownerToReceipts[_address];
        return receipt_ids;
    }

    function getLockTokens(address _address) external view returns (uint256){
        uint256[] memory myReceipts = ownerToReceipts[_address];
        uint256 amount = 0;

        for (uint256 i = 0; i < myReceipts.length; i++) {
            if (receipts[myReceipts[i]].finished == false) {
                amount = amount.add(receipts[myReceipts[i]].amount);
            }
        }

        return amount;
    }

    function fixSaveTime(uint256 _period) external onlyOwner {
        lockTime = _period;
    }

    function getReceiptInfo(uint256 index) public view returns (bytes32, string memory, uint256, bool){
        string memory targetAddress = receipts[index].targetAddress;
        return (sha256(abi.encode(index)), targetAddress, receipts[index].amount, receipts[index].finished);
    }
}