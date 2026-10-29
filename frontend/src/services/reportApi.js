import api from '../api/axios';

const getSalesReport = async (startDate, endDate) => {
  const res = await api.get('/reports/sales', { params: { startDate, endDate } });
  return res.data.data;
};

const getGSTSummary = async (startDate, endDate) => {
  const res = await api.get('/reports/gst/summary', { params: { startDate, endDate } });
  return res.data.data;
};

const getGSTRateWise = async (startDate, endDate) => {
  const res = await api.get('/reports/gst/rate-wise', { params: { startDate, endDate } });
  return res.data.data;
};

const getGSTHSNWise = async (startDate, endDate, page = 1, limit = 50) => {
  const res = await api.get('/reports/gst/hsn-wise', { params: { startDate, endDate, page, limit } });
  return res.data;
};

export default {
  getSalesReport,
  getGSTSummary,
  getGSTRateWise,
  getGSTHSNWise
};
