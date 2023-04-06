// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.9;

contract Structs {
  struct Employee {
    address managerAddress;
    uint256 salary;
    uint256 joinDate;
  }

  struct MonthYear {
    uint256 month;
    uint256 year;
  }

  struct TimeConfig {
    uint256 hour;
    uint256 minute;
    uint256 second;
    uint256 buffer;
  }

  struct CheckInDay {
    bool checkInFlag;
    uint256 workingDays;
    uint256 salary;
    bool claimed;
  }
}
