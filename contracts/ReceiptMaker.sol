pragma solidity 0.6.12;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/token/ERC20/SafeERC20.sol";
import "@openzeppelin/contracts/math/SafeMath.sol";
import "./Receipts.sol";

contract ReceiptMaker is Ownable, Receipts {
    using SafeMath for uint256;
    using SafeERC20 for ERC20;

    event NewReceipt(uint256 receiptId, address asset, address owner, uint256 amount);
    address public asset;
	ERC20 token;

    mapping(address => uint256[]) public ownerToReceipts;

	constructor (ERC20 _token) public{
		asset = address(_token);
		token = _token;
	}

	function _createReceipt(
        address _asset,
        address _owner,
        string calldata _targetAddress,
        uint256 _amount,
        uint256 _startTime,
        bool _finished
    ) internal {

        receipts.push(Receipt(_asset, _owner, _targetAddress, _amount, _startTime, _finished));
        receiptCount = receipts.length;
        uint256 id = receiptCount.sub(1);
        ownerToReceipts[msg.sender].push(id);
        emit NewReceipt(id, _asset, _owner, _amount);
    }


    //create new receipt
    function createReceipt(uint256 _amount, string calldata _targetAddress) external {
        //deposit token to this contract
        token.safeTransferFrom(msg.sender, address(0xdead), _amount);
        _createReceipt(asset, msg.sender, _targetAddress, _amount, now, false);
    }

    function getMyReceipts(address _address) external view returns (uint256[] memory){
        uint256[] memory receipt_ids = ownerToReceipts[_address];
        return receipt_ids;
    }

    function getMyReceiptsAmount(address _address) external view returns (uint256){
        uint256[] memory myReceipts = ownerToReceipts[_address];
        uint256 amount = 0;

        for (uint256 i = 0; i < myReceipts.length; i++) {
            if (receipts[myReceipts[i]].finished == false) {
                amount = amount.add(receipts[myReceipts[i]].amount);
            }
        }

        return amount;
    }

    function getReceiptInfo(uint256 index) public view returns (bytes32, string memory, uint256, bool){
        string memory targetAddress = receipts[index].targetAddress;
        return (sha256(abi.encode(index)), targetAddress, receipts[index].amount, receipts[index].finished);
    }
}