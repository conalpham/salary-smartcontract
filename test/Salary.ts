/* eslint-disable @typescript-eslint/no-unused-vars */
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';
import { ethers, upgrades } from 'hardhat';
import { expect } from 'chai';
import { loadFixture, time } from '@nomicfoundation/hardhat-network-helpers';
import { Salary } from '../typechain';

const MAX_CHANGE_WORKING_DAYS = 10;
const CHECK_IN_TIME_CONFIG = {
  hour: 8,
  minute: 0,
  second: 0,
  buffer: 900,
};
const CHECK_OUT_TIME_CONFIG = {
  hour: 16,
  minute: 0,
  second: 0,
  buffer: 900,
};

describe('B2E', () => {
  let admin: SignerWithAddress;
  let employees1: SignerWithAddress;
  let employees2: SignerWithAddress;
  let manager1: SignerWithAddress;
  let manager2: SignerWithAddress;

  async function deployFixtures() {
    const SalaryFactory = await ethers.getContractFactory('Salary');
    const salary = (await upgrades.deployProxy(SalaryFactory, [
      admin.address,
      MAX_CHANGE_WORKING_DAYS,
      CHECK_IN_TIME_CONFIG,
      CHECK_OUT_TIME_CONFIG,
    ])) as Salary;
    await Promise.all([salary.deployed()]);

    return { salary };
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
    const { salary } = await loadFixture(deployFixtures);
    await salary.addEmployee(employees1.address, manager1.address, 100);
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

  it('Should check in successfully', async () => {
    const { salary } = await loadFixture(deployFixtures);
    await salary.addEmployee(employees1.address, manager1.address, 100);
    const month = new Date().getMonth();
    const year = new Date().getFullYear();

    await time.increaseTo(1683187206);

    const timeCheckIn = await time.latest();

    await expect(salary.connect(employees1).checkIn())
      .to.emit(salary, 'CheckIn')
      .withArgs(employees1.address, (await time.latest()) + 1);
  });
});
