// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.9;

abstract contract DateTimeAPI {
  /*
   *  Abstract contract for interfacing with the DateTime contract.
   *
   */
  function isLeapYear(uint16 year) public pure virtual returns (bool);

  function getYear(uint256 timestamp) public pure virtual returns (uint16);

  function getMonth(uint256 timestamp) public pure virtual returns (uint8);

  function getDay(uint256 timestamp) public pure virtual returns (uint8);

  function getHour(uint256 timestamp) public pure virtual returns (uint8);

  function getMinute(uint256 timestamp) public pure virtual returns (uint8);

  function getSecond(uint256 timestamp) public pure virtual returns (uint8);

  function getWeekday(uint256 timestamp) public pure virtual returns (uint8);

  function toTimestamp(
    uint16 year,
    uint8 month,
    uint8 day
  ) public pure virtual returns (uint256 timestamp);

  function toTimestamp(
    uint16 year,
    uint8 month,
    uint8 day,
    uint8 hour
  ) public pure virtual returns (uint256 timestamp);

  function toTimestamp(
    uint16 year,
    uint8 month,
    uint8 day,
    uint8 hour,
    uint8 minute
  ) public pure virtual returns (uint256 timestamp);

  function toTimestamp(
    uint16 year,
    uint8 month,
    uint8 day,
    uint8 hour,
    uint8 minute,
    uint8 second
  ) public pure virtual returns (uint256 timestamp);
}
