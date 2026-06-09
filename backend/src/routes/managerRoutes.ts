import { Router } from 'express';
import { authenticate }    from '../middleware/authenticate.js';
import { requireRole }     from '../middleware/requireRole.js';
import {
  getOrganization, updateOrganization,
  getStaff, updateStaffStatus, deleteStaff, updateStaffProfile,
  getReports,
  reassignLabOrder,
} from '../controllers/managerController.js';
import {
  createDepartment,
  getDepartments,
  updateDepartment,
  deleteDepartment,
  getDepartmentMembers,
  assignDepartmentMembers,
} from '../controllers/organizationController.js';

const router = Router();

router.use(authenticate);
router.use(requireRole('MANAGER'));

// Organization
router.get('/organization',              getOrganization);
router.patch('/organization',            updateOrganization);

// Staff
router.get('/staff',                     getStaff);
router.patch('/staff/:userId/status',    updateStaffStatus);
router.patch('/staff/:userId/profile',   updateStaffProfile);
router.delete('/staff/:userId',          deleteStaff);

// Departments
router.get('/departments',                          getDepartments);
router.post('/departments',                         createDepartment);
router.patch('/departments/:departmentId',          updateDepartment);
router.delete('/departments/:departmentId',         deleteDepartment);
router.get('/departments/:departmentId/members',    getDepartmentMembers);
router.patch('/departments/:departmentId/members',  assignDepartmentMembers);

// Reports
router.get('/reports',                              getReports);

// Lab order management
router.patch('/lab-orders/:testId/reassign',        reassignLabOrder);

export default router;
