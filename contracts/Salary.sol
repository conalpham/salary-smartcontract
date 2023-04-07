// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.9;

import '@openzeppelin/contracts-upgradeable/security/ReentrancyGuardUpgradeable.sol';
import '@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol';
import '@openzeppelin/contracts-upgradeable/utils/math/SafeMathUpgradeable.sol';
import '@openzeppelin/contracts-upgradeable/security/PausableUpgradeable.sol';

import './common/Structs.sol';
import './external/DateTime.sol';
import './external/SafeMathX.sol';

contract Salary is DateTime, Structs, PausableUpgradeable, ReentrancyGuardUpgradeable, UUPSUpgradeable {
  using SafeMathX for uint256;
  using SafeMathUpgradeable for uint256;

  address public admin;
  mapping(address => Employee) private _employee;
  mapping(uint256 => mapping(address => CheckInDay)) private _checkinInfo;
  uint256 public checkInTimeBuffer;
  uint256 public checkOutTimeBuffer;
  TimeConfig public checkInConfig;
  TimeConfig public checkOutConfig;
  uint256 public maxChangeWorkkingDays;
  uint256 public amountEmployee;

  event CheckIn(address indexed employeeAddress, uint256 indexed timestamp);
  event CheckOut(address indexed employeeAddress, uint256 indexed timestamp);
  event ClaimSalary(address indexed employeeAddress, uint256 month, uint256 year, uint256 amount, uint256 indexed timestamp);
  event AddFund(uint256 indexed amount);
  event AddEmployee(address indexed employeeAddress, address managerAddress, uint256 indexed salary);
  event UpdateEmployee(address indexed employeeAddress, uint256 indexed salary);
  event ChangePaymentAddress(address indexed _employeeAddress, address indexed _newAddress);
  event RemoveEmployee(address indexed employeeAddress);
  event ChangeWorkingDays(address indexed changedBy, address indexed employeeAddress, uint256 indexed workingDays);
  event ChangeCheckInConfig(uint256 hour, uint256 minute, uint256 second, uint256 buffer);
  event ChangeCheckOutConfig(uint256 hour, uint256 minute, uint256 second, uint256 buffer);
  event ChangeMaxChangeWorkingDays(uint256 indexed maxChangeWorkingDays);
  event ChangeAdmin(address indexed admin);
  event ChangeSalary(address indexed employeeAddress, uint256 indexed salary);
  event ChangeManager(address indexed employeeAddress, address indexed managerAddress);

  modifier onlyAdmin() {
    require(msg.sender == admin, 'Only admin can call this function');
    _;
  }

  function initialize(
    address _admin,
    uint256 _maxChangeWorkingDays,
    TimeConfig calldata _checkInConfig,
    TimeConfig calldata _checkOutConfig
  ) external initializer {
    __Pausable_init();
    __ReentrancyGuard_init();
    __UUPSUpgradeable_init();
    admin = _admin;
    maxChangeWorkkingDays = _maxChangeWorkingDays;
    checkInConfig = _checkInConfig;
    checkOutConfig = _checkOutConfig;
  }

  function _authorizeUpgrade(address) internal override onlyAdmin {}

  function test() external view returns (uint256) {
    uint256 checkInTime = block.timestamp;
    return uint256(getHour(checkInTime)) * 60 * 60 + uint256(getMinute(checkInTime)) * 60 + uint256(getSecond(checkInTime));
  }

  function checkIn() external whenNotPaused nonReentrant {
    address employeeAddress = msg.sender;
    uint256 checkInTime = block.timestamp;
    require(_employee[employeeAddress].salary != 0, 'Employee does not exist');
    uint256 weekDay = getWeekday(checkInTime);
    require(weekDay != 0 && weekDay != 6, 'Weekend is not allowed');
    uint256 checkIn = uint256(getHour(checkInTime)) * 60 * 60 + uint256(getMinute(checkInTime)) * 60 + uint256(getSecond(checkInTime));
    require(
      checkIn >= checkInConfig.hour * 60 * 60 + checkInConfig.minute * 60 + checkInConfig.second - checkInConfig.buffer &&
        checkIn <= checkInConfig.hour * 60 * 60 + checkInConfig.minute * 60 + checkInConfig.second + checkInConfig.buffer,
      'Check in time is not allowed'
    );

    uint256 month = getMonth(checkInTime);
    uint256 year = getYear(checkInTime);
    uint256 key = year * 100 + month;

    CheckInDay storage checkInDay = _checkinInfo[key][employeeAddress];
    if (checkInDay.workingDays == 0) {
      checkInDay.salary = _employee[employeeAddress].salary;
    }
    checkInDay.checkInFlag = true;

    emit CheckIn(employeeAddress, checkInTime);
  }

  function checkOut() external whenNotPaused nonReentrant {
    address employeeAddress = msg.sender;
    uint256 checkOutTime = block.timestamp;
    require(_employee[employeeAddress].salary != 0, 'Employee does not exist');
    uint256 weekDay = getWeekday(checkOutTime);
    require(weekDay != 0 && weekDay != 6, 'Weekend is not allowed');
    uint256 checkOut = uint256(getHour(checkOutTime)) * 60 * 60 + uint256(getMinute(checkOutTime)) * 60 + uint256(getSecond(checkOutTime));
    require(
      checkOut >= checkOutConfig.hour * 60 * 60 + checkOutConfig.minute * 60 + checkOutConfig.second &&
        checkOut <= checkOutConfig.hour * 60 * 60 + checkOutConfig.minute * 60 + checkOutConfig.second + checkOutConfig.buffer,
      'Check out time is not allowed'
    );

    uint256 month = getMonth(checkOutTime);
    uint256 year = getYear(checkOutTime);
    uint256 key = year * 100 + month;

    CheckInDay storage checkInDay = _checkinInfo[key][employeeAddress];

    require(checkInDay.checkInFlag, 'Check in first');
    checkInDay.checkInFlag = false;
    checkInDay.workingDays += 1;

    emit CheckOut(employeeAddress, checkOutTime);
  }

  function changeWorkingDaysByAdmin(
    address _employeeAddress,
    uint256 _month,
    uint256 _year,
    uint256 _workingDays
  ) external onlyAdmin {
    require(_employee[_employeeAddress].salary != 0, 'Employee does not exist');
    require(_month > 0 && _month < 13, 'Invalid month');
    require(_workingDays > 0 && _workingDays < 32, 'Invalid working days');

    uint256 key = _year * 100 + _month;
    _checkinInfo[key][_employeeAddress].workingDays = _workingDays;
    if (_checkinInfo[key][_employeeAddress].salary == 0) {
      _checkinInfo[key][_employeeAddress].salary = _employee[_employeeAddress].salary;
    }

    emit ChangeWorkingDays(msg.sender, _employeeAddress, _workingDays);
  }

  function changeWorkingDays(
    address _employeeAddress,
    uint256 _month,
    uint256 _year,
    uint256 _workingDays
  ) external {
    require(_employee[_employeeAddress].salary != 0, 'Employee does not exist');
    require(_month > 0 && _month < 13, 'Invalid month');
    require(_workingDays > 0 && _workingDays < 32, 'Invalid working days');
    require(msg.sender == _employee[_employeeAddress].managerAddress, 'Only manager can call this function');

    uint256 key = _year * 100 + _month;
    if (_workingDays > _checkinInfo[key][_employeeAddress].workingDays) {
      require(_workingDays - _checkinInfo[key][_employeeAddress].workingDays <= maxChangeWorkkingDays, 'Exceed max change working days');
    } else {
      require(_checkinInfo[key][_employeeAddress].workingDays - _workingDays <= maxChangeWorkkingDays, 'Exceed max change working days');
    }

    _checkinInfo[key][_employeeAddress].workingDays = _workingDays;
    if (_checkinInfo[key][_employeeAddress].salary == 0) {
      _checkinInfo[key][_employeeAddress].salary = _employee[_employeeAddress].salary;
    }

    emit ChangeWorkingDays(msg.sender, _employeeAddress, _workingDays);
  }

  function addEmployee(
    address _employeeAddress,
    address _managerAddress,
    uint256 _salary
  ) external onlyAdmin {
    require(_employee[_employeeAddress].salary == 0, 'Employee already exists');
    _employee[_employeeAddress] = Employee(_managerAddress, _salary, block.timestamp);

    amountEmployee += 1;

    emit AddEmployee(_employeeAddress, _managerAddress, _salary);
  }

  function removeEmployee(address _employeeAddress) external onlyAdmin {
    require(_employee[_employeeAddress].salary != 0, 'Employee does not exist');
    _partialPaid(_employeeAddress);
    amountEmployee -= 1;
    delete _employee[_employeeAddress];

    emit RemoveEmployee(_employeeAddress);
  }

  function getPaid(uint256 month, uint256 year) external whenNotPaused nonReentrant {
    address employeeAddress = msg.sender;
    uint256 timeClaim = block.timestamp;
    require(_employee[employeeAddress].salary != 0, 'Employee does not exist');
    require(month > 0 && month < 13, 'Invalid month');

    require(uint256(getMonth(timeClaim)) + uint256(getYear(timeClaim)) * 100 > month + year * 100, 'Can not claim salary for future month');

    uint256 key = year * 100 + month;
    require(_checkinInfo[key][employeeAddress].workingDays > 0, 'No working days');
    require(_checkinInfo[key][employeeAddress].claimed == false, 'Already claimed');
    uint256 payment = _checkinInfo[key][employeeAddress].salary * _checkinInfo[key][employeeAddress].workingDays;
    require(address(this).balance >= payment, 'Not enough fund');
    _checkinInfo[key][employeeAddress].claimed = true;
    payable(employeeAddress).transfer(payment);

    emit ClaimSalary(employeeAddress, month, year, payment, timeClaim);
  }

  function pause() external onlyAdmin {
    _pause();
  }

  function unpause() external onlyAdmin {
    _unpause();
  }

  function addFund() external payable onlyAdmin {
    require(msg.value > 0, 'No fund added');

    emit AddFund(msg.value);
  }

  function changeAdmin(address _admin) external onlyAdmin {
    admin = _admin;
    emit ChangeAdmin(_admin);
  }

  function changeCheckOutConfig(
    uint256 _hour,
    uint256 _minute,
    uint256 _second,
    uint256 _buffer
  ) external onlyAdmin {
    checkOutConfig = TimeConfig(_hour, _minute, _second, _buffer);

    emit ChangeCheckOutConfig(_hour, _minute, _second, _buffer);
  }

  function changeCheckInConfig(
    uint256 _hour,
    uint256 _minute,
    uint256 _second,
    uint256 _buffer
  ) external onlyAdmin {
    checkInConfig = TimeConfig(_hour, _minute, _second, _buffer);

    emit ChangeCheckInConfig(_hour, _minute, _second, _buffer);
  }

  function changeMaxChangeWorkingDays(uint256 _maxChangeWorkkingDays) external onlyAdmin {
    maxChangeWorkkingDays = _maxChangeWorkkingDays;

    emit ChangeMaxChangeWorkingDays(_maxChangeWorkkingDays);
  }

  function changeSalary(address _employeeAddress, uint256 _salary) external onlyAdmin {
    require(_employee[_employeeAddress].salary != 0, 'Employee does not exist');
    _employee[_employeeAddress].salary = _salary;

    emit ChangeSalary(_employeeAddress, _salary);
  }

  function changeManager(address _employeeAddress, address _managerAddress) external onlyAdmin {
    require(_employee[_employeeAddress].salary != 0, 'Employee does not exist');
    _employee[_employeeAddress].managerAddress = _managerAddress;

    emit ChangeManager(_employeeAddress, _managerAddress);
  }

  function changePaymentAddress(address _employeeAddress, address _newAddress) external onlyAdmin {
    require(_employee[_employeeAddress].salary != 0, 'Employee does not exist');
    _partialPaid(_employeeAddress);
    _employee[_newAddress] = _employee[_employeeAddress];
    delete _employee[_employeeAddress];

    uint256 month = getMonth(block.timestamp);
    uint256 year = getYear(block.timestamp);
    uint256 key = year * 100 + month;
    _checkinInfo[key][_newAddress] = _checkinInfo[key][_employeeAddress];
    delete _checkinInfo[key][_employeeAddress];

    emit ChangePaymentAddress(_employeeAddress, _newAddress);
  }

  function getEmployeeInfo(address _employeeAddress)
    external
    view
    returns (
      address,
      uint256,
      uint256
    )
  {
    require(_employee[_employeeAddress].salary != 0, 'Employee does not exist');
    require(
      msg.sender == _employeeAddress || msg.sender == _employee[_employeeAddress].managerAddress || msg.sender == admin,
      'Only manager or owner can call this function'
    );
    return (_employee[_employeeAddress].managerAddress, _employee[_employeeAddress].salary, _employee[_employeeAddress].joinDate);
  }

  function getCheckInInfo(
    address _employeeAddress,
    uint256 _month,
    uint256 _year
  )
    external
    view
    returns (
      bool,
      uint256,
      uint256,
      bool
    )
  {
    require(_employee[_employeeAddress].salary != 0, 'Employee does not exist');
    require(
      msg.sender == _employeeAddress || msg.sender == _employee[_employeeAddress].managerAddress || msg.sender == admin,
      'Only manager or owner can call this function'
    );
    uint256 key = _year * 100 + _month;
    return (
      _checkinInfo[key][_employeeAddress].checkInFlag,
      _checkinInfo[key][_employeeAddress].workingDays,
      _checkinInfo[key][_employeeAddress].salary,
      _checkinInfo[key][_employeeAddress].claimed
    );
  }

  function _partialPaid(address _employeeAddress) internal {
    uint256 month = getMonth(block.timestamp);
    uint256 year = getYear(block.timestamp);
    uint256 key = year * 100 + month;
    uint256 payment = _checkinInfo[key][_employeeAddress].salary * _checkinInfo[key][_employeeAddress].workingDays;
    payable(_employeeAddress).transfer(payment);
  }
}
