/* eslint-disable no-await-in-loop */
/* eslint-disable @typescript-eslint/no-unused-vars */
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';
import { ethers, upgrades } from 'hardhat';
import { expect } from 'chai';
import { loadFixture, time } from '@nomicfoundation/hardhat-network-helpers';
import dayjs from 'dayjs';
import { BigNumber, ContractTransaction } from 'ethers';
import { Salary, TooUpToken } from 'typechain-types';

const MAX_CHANGE_WORKING_DAYS = 10;
const CHECK_IN_TIME_CONFIG = {
  hour: 8,
  minute: 0,
  second: 0,
  buffer: 900,
};
const CHECK_OUT_TIME_CONFIG = {
  hour: 17,
  minute: 0,
  second: 0,
  buffer: 900,
};

const GMT = 7;

describe('Salary', () => {
  let admin: SignerWithAddress;
  let employees1: SignerWithAddress;
  let employees2: SignerWithAddress;
  let manager1: SignerWithAddress;
  let manager2: SignerWithAddress;

  async function deployFixtures() {
    const TokenFactory = await ethers.getContractFactory('TooUpToken');
    const token = (await TokenFactory.deploy('Too Up Coin', 'TUC', '1000000000', admin.address)) as TooUpToken;

    const SalaryFactory = await ethers.getContractFactory('Salary');
    const salary = (await upgrades.deployProxy(SalaryFactory, [
      admin.address,
      MAX_CHANGE_WORKING_DAYS,
      CHECK_IN_TIME_CONFIG,
      CHECK_OUT_TIME_CONFIG,
      token.address,
    ])) as Salary;
    await Promise.all([salary.deployed(), token.deployed()]);

    return { salary, token };
  }
  beforeEach(async () => {
    [admin, employees1, manager1, employees2, manager2] = await ethers.getSigners();
  });

  it('Should initialize', async () => {
    const { salary } = await loadFixture(deployFixtures);
    expect(await salary.admin()).to.equal(admin.address);
    expect(await salary.maxChangeWorkkingDays()).to.equal(MAX_CHANGE_WORKING_DAYS);
  });

  it('Should add employee', async () => {
    const { salary } = await loadFixture(deployFixtures);
    await expect(salary.addEmployee(employees1.address, manager1.address, 100))
      .to.emit(salary, 'AddEmployee')
      .withArgs(employees1.address, manager1.address, 100);

    const employeeInfo = await salary.getEmployeeInfo(employees1.address);
    expect(employeeInfo[0]).to.equal(manager1.address);
    expect(employeeInfo[1]).to.equal(100);
    expect(employeeInfo[2]).to.equal(await time.latest());

    await expect(salary.connect(employees1).addEmployee(employees1.address, manager1.address, 100)).to.be.revertedWith(
      'Only admin can call this function'
    );
    await expect(salary.addEmployee(employees1.address, manager1.address, 100)).to.be.revertedWith('Employee already exists');
  });

  it('Should remove employee', async () => {
    const { salary, token } = await loadFixture(deployFixtures);
    await salary.addEmployee(employees1.address, manager1.address, 100);

    const checkInTime = dayjs(new Date())
      .add(7, 'day')
      .day(1)
      .hour(CHECK_IN_TIME_CONFIG.hour + GMT)
      .minute(CHECK_IN_TIME_CONFIG.minute)
      .second(CHECK_IN_TIME_CONFIG.second);
    const checkOutTime = dayjs(new Date())
      .add(7, 'day')
      .day(1)
      .hour(CHECK_OUT_TIME_CONFIG.hour + GMT)
      .minute(CHECK_OUT_TIME_CONFIG.minute)
      .second(CHECK_OUT_TIME_CONFIG.second);

    await time.increaseTo(checkInTime.valueOf());
    await salary.connect(employees1).checkIn();

    await time.increaseTo(checkOutTime.valueOf());
    await salary.connect(employees1).checkOut();

    await expect(salary.removeEmployee(employees1.address)).to.be.revertedWith('ERC20: transfer amount exceeds balance');

    await token.approve(salary.address, 100);
    await expect(salary.addFund(100)).to.emit(salary, 'AddFund').withArgs(100);
    await expect(salary.removeEmployee(employees1.address)).to.emit(salary, 'RemoveEmployee').withArgs(employees1.address);

    await expect(salary.connect(employees1).removeEmployee(employees1.address)).to.be.revertedWith('Only admin can call this function');
    await expect(salary.removeEmployee(employees1.address)).to.be.revertedWith('Employee does not exist');
  });

  it('Should update employee', async () => {
    const { salary } = await loadFixture(deployFixtures);
    await salary.addEmployee(employees1.address, manager1.address, 100);
    const joinDate = await time.latest();

    // Change Salary
    await expect(salary.changeSalary(employees1.address, 200)).to.emit(salary, 'ChangeSalary').withArgs(employees1.address, 200);
    await expect(salary.connect(employees1).changeSalary(employees1.address, 200)).to.be.revertedWith('Only admin can call this function');

    // Change Manager
    await expect(salary.changeManager(employees1.address, manager2.address))
      .to.emit(salary, 'ChangeManager')
      .withArgs(employees1.address, manager2.address);
    await expect(salary.connect(employees1).changeManager(employees1.address, manager2.address)).to.be.revertedWith(
      'Only admin can call this function'
    );

    const employeeInfo = await salary.getEmployeeInfo(employees1.address);
    expect(employeeInfo[0]).to.equal(manager2.address);
    expect(employeeInfo[1]).to.equal(200);
    expect(employeeInfo[2]).to.equal(joinDate);

    // Change Payment Address
    await expect(salary.changePaymentAddress(employees1.address, employees2.address))
      .to.emit(salary, 'ChangePaymentAddress')
      .withArgs(employees1.address, employees2.address);
    await expect(salary.connect(employees1).changePaymentAddress(employees1.address, employees2.address)).to.be.revertedWith(
      'Only admin can call this function'
    );

    // Employee does not exist
    await expect(salary.changeSalary(employees1.address, 200)).to.be.revertedWith('Employee does not exist');
    await expect(salary.changeManager(employees1.address, manager2.address)).to.be.revertedWith('Employee does not exist');
    await expect(salary.changePaymentAddress(employees1.address, employees2.address)).to.be.revertedWith('Employee does not exist');

    const employeeInfo2 = await salary.getEmployeeInfo(employees2.address);
    expect(employeeInfo2[0]).to.equal(manager2.address);
    expect(employeeInfo2[1]).to.equal(200);
    expect(employeeInfo2[2]).to.equal(joinDate);
  });

  it('Should change max change working days', async () => {
    const { salary } = await loadFixture(deployFixtures);
    await expect(salary.changeMaxChangeWorkingDays(20)).to.emit(salary, 'ChangeMaxChangeWorkingDays').withArgs(20);
    expect(await salary.maxChangeWorkkingDays()).to.equal(20);
    await expect(salary.connect(employees1).changeMaxChangeWorkingDays(20)).to.be.revertedWith('Only admin can call this function');
  });

  it('Should change admin', async () => {
    const { salary } = await loadFixture(deployFixtures);
    await expect(salary.changeAdmin(employees1.address)).to.emit(salary, 'ChangeAdmin').withArgs(employees1.address);
    expect(await salary.admin()).to.equal(employees1.address);
    await expect(salary.connect(manager1).changeAdmin(employees1.address)).to.be.revertedWith('Only admin can call this function');
  });

  it('Should change working days by manager', async () => {
    const { salary } = await loadFixture(deployFixtures);
    await salary.addEmployee(employees1.address, manager1.address, 100);
    const month = new Date().getMonth();
    const year = new Date().getFullYear();

    await expect(salary.connect(manager1).changeWorkingDays(employees1.address, month, year, 4))
      .to.emit(salary, 'ChangeWorkingDays')
      .withArgs(manager1.address, employees1.address, 4);

    await expect(salary.connect(employees1).changeWorkingDays(employees1.address, month, year, 20)).to.be.revertedWith(
      'Only manager can call this function'
    );
    await expect(salary.connect(manager1).changeWorkingDays(employees1.address, month, year, 0)).to.be.revertedWith('Invalid working days');
    await expect(salary.connect(manager1).changeWorkingDays(employees1.address, month, year, 32)).to.be.revertedWith('Invalid working days');
    await expect(salary.connect(manager1).changeWorkingDays(employees1.address, 13, year, 20)).to.be.revertedWith('Invalid month');
    await expect(salary.connect(manager1).changeWorkingDays(employees1.address, 0, 2022, 20)).to.be.revertedWith('Invalid month');
    await expect(salary.connect(manager1).changeWorkingDays(employees1.address, month, year, 20)).to.be.revertedWith(
      'Exceed max change working days'
    );
    await expect(salary.connect(manager1).changeWorkingDays(employees2.address, month, year, 20)).to.be.revertedWith('Employee does not exist');

    await expect(salary.connect(manager1).changeWorkingDays(employees1.address, month, year, 14))
      .to.emit(salary, 'ChangeWorkingDays')
      .withArgs(manager1.address, employees1.address, 14);

    await expect(salary.connect(manager1).changeWorkingDays(employees1.address, month, year, 2)).to.be.revertedWith(
      'Exceed max change working days'
    );

    const checkInInfo = await salary.getCheckInInfo(employees1.address, month, year);
    expect(checkInInfo[1]).to.equal(14);
    expect(checkInInfo[2]).to.equal(100);
  });

  it('Should change working days by admin', async () => {
    const { salary } = await loadFixture(deployFixtures);
    await salary.addEmployee(employees1.address, manager1.address, 100);
    const month = new Date().getMonth();
    const year = new Date().getFullYear();

    await expect(salary.changeWorkingDaysByAdmin(employees1.address, month, year, 4))
      .to.emit(salary, 'ChangeWorkingDays')
      .withArgs(admin.address, employees1.address, 4);

    await expect(salary.connect(manager1).changeWorkingDaysByAdmin(employees1.address, month, year, 20)).to.be.revertedWith(
      'Only admin can call this function'
    );
    await expect(salary.changeWorkingDaysByAdmin(employees1.address, month, year, 0)).to.be.revertedWith('Invalid working days');
    await expect(salary.changeWorkingDaysByAdmin(employees1.address, month, year, 32)).to.be.revertedWith('Invalid working days');
    await expect(salary.changeWorkingDaysByAdmin(employees1.address, 13, year, 20)).to.be.revertedWith('Invalid month');
    await expect(salary.changeWorkingDaysByAdmin(employees1.address, 0, 2022, 20)).to.be.revertedWith('Invalid month');
    await expect(salary.changeWorkingDaysByAdmin(employees2.address, month, year, 20)).to.be.revertedWith('Employee does not exist');

    await expect(salary.changeWorkingDaysByAdmin(employees1.address, month, year, 30))
      .to.emit(salary, 'ChangeWorkingDays')
      .withArgs(admin.address, employees1.address, 30);

    const checkInInfo = await salary.getCheckInInfo(employees1.address, month, year);
    expect(checkInInfo[1]).to.equal(30);
    expect(checkInInfo[2]).to.equal(100);
  });

  it('Should check in, check out successfully', async () => {
    const { salary } = await loadFixture(deployFixtures);
    await salary.addEmployee(employees1.address, manager1.address, 100);

    const checkInTime = dayjs(new Date())
      .add(7, 'day')
      .day(1)
      .hour(CHECK_IN_TIME_CONFIG.hour + 7)
      .minute(CHECK_IN_TIME_CONFIG.minute)
      .second(CHECK_IN_TIME_CONFIG.second);
    const month = checkInTime.month() + 1;
    const year = checkInTime.year();

    await time.increaseTo(checkInTime.valueOf());
    await expect(salary.connect(employees1).checkIn())
      .to.emit(salary, 'CheckIn')
      .withArgs(employees1.address, (await time.latest()) + 1);

    const checkInInfo = await salary.getCheckInInfo(employees1.address, month, year);
    expect(checkInInfo[0]).to.equal(true);
    expect(checkInInfo[1]).to.equal(0);
    expect(checkInInfo[2]).to.equal(100);
    expect(checkInInfo[3]).to.equal(false);

    const checkOutTime = dayjs(new Date())
      .add(7, 'day')
      .day(1)
      .hour(CHECK_OUT_TIME_CONFIG.hour + GMT)
      .minute(CHECK_OUT_TIME_CONFIG.minute)
      .second(CHECK_OUT_TIME_CONFIG.second);

    await time.increaseTo(checkOutTime.valueOf());
    await expect(salary.connect(employees1).checkOut())
      .to.emit(salary, 'CheckOut')
      .withArgs(employees1.address, (await time.latest()) + 1);

    const checkOutInfo = await salary.getCheckInInfo(employees1.address, month, year);
    expect(checkOutInfo[0]).to.equal(false);
    expect(checkOutInfo[1]).to.equal(1);
    expect(checkOutInfo[2]).to.equal(100);
    expect(checkOutInfo[3]).to.equal(false);
  });

  it('Should check in, check out fail with weekend', async () => {
    const { salary } = await loadFixture(deployFixtures);
    await salary.addEmployee(employees1.address, manager1.address, 100);

    const saturday = dayjs(new Date())
      .add(7, 'day')
      .day(6)
      .hour(CHECK_IN_TIME_CONFIG.hour)
      .minute(CHECK_IN_TIME_CONFIG.minute)
      .second(CHECK_IN_TIME_CONFIG.second);
    const sunday = saturday.add(1, 'day');

    // Check in on saturday
    await time.increaseTo(saturday.valueOf());
    await expect(salary.connect(employees1).checkIn()).to.rejectedWith('Weekend is not allowed');

    // Check in on sunday
    await time.increaseTo(sunday.valueOf());
    await expect(salary.connect(employees1).checkIn()).to.rejectedWith('Weekend is not allowed');
  });

  it('Should check in, check out fail with invalid time', async () => {
    const { salary } = await loadFixture(deployFixtures);
    await salary.addEmployee(employees1.address, manager1.address, 100);

    const checkInTime = dayjs(new Date())
      .add(7, 'day')
      .day(1)
      .hour(CHECK_IN_TIME_CONFIG.hour + GMT)
      .minute(CHECK_IN_TIME_CONFIG.minute)
      .second(CHECK_IN_TIME_CONFIG.second);

    const checkOutTime = dayjs(new Date())
      .add(7, 'day')
      .day(1)
      .hour(CHECK_OUT_TIME_CONFIG.hour + GMT)
      .minute(CHECK_OUT_TIME_CONFIG.minute)
      .second(CHECK_OUT_TIME_CONFIG.second);

    // Check in before 7:45 and after 8:15
    await time.increaseTo(checkInTime.subtract(16, 'minute').valueOf());
    await expect(salary.connect(employees1).checkIn()).to.rejectedWith('Check in time is not allowed');

    await time.increaseTo(checkInTime.add(16, 'minute').valueOf());
    await expect(salary.connect(employees1).checkIn()).to.rejectedWith('Check in time is not allowed');

    // Check out before 17:00 and after 17:15
    await time.increaseTo(checkOutTime.subtract(1, 'minute').valueOf());
    await expect(salary.connect(employees1).checkOut()).to.rejectedWith('Check out time is not allowed');

    await time.increaseTo(checkOutTime.add(16, 'minute').valueOf());
    await expect(salary.connect(employees1).checkOut()).to.rejectedWith('Check out time is not allowed');
  });

  it('Should correct when check in on last day of month, check out on the next month', async () => {
    const { salary } = await loadFixture(deployFixtures);
    await salary.addEmployee(employees1.address, manager1.address, 100);

    const checkInTime = dayjs(new Date())
      .add(7, 'day')
      .day(1)
      .hour(CHECK_IN_TIME_CONFIG.hour + GMT)
      .minute(CHECK_IN_TIME_CONFIG.minute)
      .second(CHECK_IN_TIME_CONFIG.second);

    const checkOutTime = dayjs(new Date())
      .add(7, 'day')
      .day(1)
      .hour(CHECK_OUT_TIME_CONFIG.hour + GMT)
      .minute(CHECK_OUT_TIME_CONFIG.minute)
      .second(CHECK_OUT_TIME_CONFIG.second);

    await time.increaseTo(checkInTime.valueOf());
    await salary.connect(employees1).checkIn();

    await time.increaseTo(checkOutTime.add(1, 'month').valueOf());
    await expect(salary.connect(employees1).checkOut()).to.rejectedWith('Check in first');

    const checkInInfo = await salary.getCheckInInfo(employees1.address, checkInTime.month() + 1, checkInTime.year());
    expect(checkInInfo[0]).to.equal(true);
    expect(checkInInfo[1]).to.equal(0);
    expect(checkInInfo[2]).to.equal(100);
    expect(checkInInfo[3]).to.equal(false);
  });

  it('Should get paid reject in fail case', async () => {
    const { salary } = await loadFixture(deployFixtures);
    await salary.addEmployee(employees1.address, manager1.address, 100);

    const checkInTime = dayjs(new Date())
      .add(7, 'day')
      .day(1)
      .hour(CHECK_IN_TIME_CONFIG.hour + GMT)
      .minute(CHECK_IN_TIME_CONFIG.minute)
      .second(CHECK_IN_TIME_CONFIG.second);
    const checkOutTime = dayjs(new Date())
      .add(7, 'day')
      .day(1)
      .hour(CHECK_OUT_TIME_CONFIG.hour + GMT)
      .minute(CHECK_OUT_TIME_CONFIG.minute)
      .second(CHECK_OUT_TIME_CONFIG.second);
    const month = checkInTime.month() + 1;
    const year = checkInTime.year();

    await time.increaseTo(checkInTime.valueOf());
    await salary.connect(employees1).checkIn();

    await time.increaseTo(checkOutTime.valueOf());
    await salary.connect(employees1).checkOut();

    await expect(salary.connect(employees1).getPaid(month, year)).to.rejectedWith('Can not claim salary for future month');

    await time.increaseTo(checkInTime.add(1, 'month').valueOf());

    await expect(salary.connect(employees1).getPaid(month, year)).to.rejectedWith('Not enough fund');
    await expect(salary.connect(employees1).getPaid(13, year)).to.rejectedWith('Invalid month');

    await expect(salary.connect(employees1).getPaid(month - 1, year)).to.rejectedWith('No working days');
    await expect(salary.connect(employees2).getPaid(month, year)).to.rejectedWith('Employee does not exist');
  });

  it('Should get paid correct in happy case', async () => {
    const { salary, token } = await loadFixture(deployFixtures);
    await salary.addEmployee(employees1.address, manager1.address, 100);

    let checkInTime = dayjs(new Date())
      .add(7, 'day')
      .day(1)
      .hour(CHECK_IN_TIME_CONFIG.hour + GMT)
      .minute(CHECK_IN_TIME_CONFIG.minute)
      .second(CHECK_IN_TIME_CONFIG.second);
    let checkOutTime = dayjs(new Date())
      .add(7, 'day')
      .day(1)
      .hour(CHECK_OUT_TIME_CONFIG.hour + GMT)
      .minute(CHECK_OUT_TIME_CONFIG.minute)
      .second(CHECK_OUT_TIME_CONFIG.second);
    const month = checkInTime.month() + 1;
    const year = checkInTime.year();

    const expectWorkingDays = checkInTime.daysInMonth() - checkInTime.date() + 1;
    let workingDay = 0;
    for (let i = 0; i < expectWorkingDays; i += 1) {
      if (checkInTime.day() !== 0 && checkInTime.day() !== 6) {
        await time.increaseTo(checkInTime.valueOf());
        await salary.connect(employees1).checkIn();

        await time.increaseTo(checkOutTime.valueOf());
        await salary.connect(employees1).checkOut();
        workingDay += 1;
      }
      checkInTime = checkInTime.add(1, 'day');
      checkOutTime = checkOutTime.add(1, 'day');
    }

    await time.increaseTo(checkInTime.add(1, 'month').valueOf());

    const balanceBefore = await token.balanceOf(employees1.address);

    await token.approve(salary.address, workingDay * 100);
    await expect(salary.addFund(workingDay * 100))
      .to.emit(salary, 'AddFund')
      .withArgs(workingDay * 100);

    const tx: ContractTransaction = await salary.connect(employees1).getPaid(month, year);
    const txReceipt = await tx.wait();

    const event = txReceipt.events?.find((item) => item.event === 'ClaimSalary');
    expect(event?.args?.employeeAddress).to.eq(employees1.address);
    expect(event?.args?.month).to.eq(month);
    expect(event?.args?.year).to.eq(year);
    expect(event?.args?.amount).to.eq(workingDay * 100);
    expect(event?.args?.timestamp).to.eq(await time.latest());

    const balanceAfter = await token.balanceOf(employees1.address);
    expect(balanceAfter).to.eq(balanceBefore.add(BigNumber.from(workingDay * 100)));

    const checkInInfo = await salary.getCheckInInfo(employees1.address, month, year);
    expect(checkInInfo[0]).to.equal(false);
    expect(checkInInfo[1]).to.equal(workingDay);
    expect(checkInInfo[2]).to.equal(100);
    expect(checkInInfo[3]).to.equal(true);

    await expect(salary.connect(employees1).getPaid(month, year)).to.rejectedWith('Already claimed');
  });

  it('Should get paid correct in happy case with multiple employees', async () => {
    const { salary, token } = await loadFixture(deployFixtures);
    await salary.addEmployee(employees1.address, manager1.address, 100);
    await salary.addEmployee(employees2.address, manager1.address, 100);

    let checkInTime = dayjs(new Date())
      .add(7, 'day')
      .day(1)
      .hour(CHECK_IN_TIME_CONFIG.hour + GMT)
      .minute(CHECK_IN_TIME_CONFIG.minute)
      .second(CHECK_IN_TIME_CONFIG.second);
    let checkOutTime = dayjs(new Date())
      .add(7, 'day')
      .day(1)
      .hour(CHECK_OUT_TIME_CONFIG.hour + GMT)
      .minute(CHECK_OUT_TIME_CONFIG.minute)
      .second(CHECK_OUT_TIME_CONFIG.second);
    const month = checkInTime.month() + 1;
    const year = checkInTime.year();

    const expectWorkingDays = checkInTime.daysInMonth() - checkInTime.date() + 1;
    let workingDay = 0;
    for (let i = 0; i < expectWorkingDays; i += 1) {
      if (checkInTime.day() !== 0 && checkInTime.day() !== 6) {
        await time.increaseTo(checkInTime.valueOf());
        await salary.connect(employees1).checkIn();
        await salary.connect(employees2).checkIn();

        await time.increaseTo(checkOutTime.valueOf());
        await salary.connect(employees1).checkOut();
        await salary.connect(employees2).checkOut();
        workingDay += 1;
      }
      checkInTime = checkInTime.add(1, 'day');
      checkOutTime = checkOutTime.add(1, 'day');
    }

    await time.increaseTo(checkInTime.add(1, 'month').valueOf());

    const balanceBefore1 = await token.balanceOf(employees1.address);
    const balanceBefore2 = await token.balanceOf(employees2.address);

    await token.approve(salary.address, workingDay * 100 * 2);
    await expect(salary.addFund(workingDay * 100 * 2))
      .to.emit(salary, 'AddFund')
      .withArgs(workingDay * 100 * 2);

    await salary.connect(employees1).getPaid(month, year);
    await salary.connect(employees2).getPaid(month, year);

    const balanceAfter1 = await token.balanceOf(employees1.address);
    const balanceAfter2 = await token.balanceOf(employees2.address);
    expect(balanceAfter1).to.eq(balanceBefore1.add(BigNumber.from(workingDay * 100)));
    expect(balanceAfter2).to.eq(balanceBefore2.add(BigNumber.from(workingDay * 100)));
  });

  it('Should withdraw fund correctly', async () => {
    const { salary, token } = await loadFixture(deployFixtures);

    await token.approve(salary.address, 1000);
    await salary.addFund(1000);

    const balanceBefore = await token.balanceOf(admin.address);
    await salary.withdrawFund(100);

    const balanceAfter = await token.balanceOf(admin.address);
    expect(balanceAfter).to.eq(balanceBefore.add(BigNumber.from(100)));
  });
});
