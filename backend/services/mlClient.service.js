const axios = require('axios');

const ML_SERVICE_URL = process.env.ML_SERVICE_URL || 'http://127.0.0.1:8000';

class MLClientService {
  constructor() {
    this.client = axios.create({
      baseURL: ML_SERVICE_URL,
      timeout: 6000,
      headers: {
        'Content-Type': 'application/json'
      }
    });
  }

  async predictWelfareRisk(features) {
    try {
      const response = await this.client.post('/predict', features);
      if (response.data && response.data.success) {
        return response.data.data;
      }
      throw new Error('Invalid response payload from ML service.');
    } catch (err) {
      if (err.code === 'ECONNREFUSED' || err.code === 'ENOTFOUND') {
        throw new Error('ML Prediction Microservice (FastAPI) is not reachable on port 8000.');
      }
      if (err.response && err.response.data && err.response.data.detail) {
        throw new Error(`ML Service Error: ${err.response.data.detail}`);
      }
      throw new Error(`ML Inference Failure: ${err.message}`);
    }
  }

  async checkHealth() {
    try {
      const response = await this.client.get('/health', { timeout: 3000 });
      return {
        isAvailable: true,
        data: response.data
      };
    } catch (err) {
      return {
        isAvailable: false,
        error: err.message
      };
    }
  }

  async getModelEvaluation() {
    try {
      const response = await this.client.get('/evaluation', { timeout: 3000 });
      return response.data;
    } catch (err) {
      return null;
    }
  }

  async getModelInfo() {
    try {
      const response = await this.client.get('/model-info', { timeout: 3000 });
      return response.data;
    } catch (err) {
      return null;
    }
  }
}

module.exports = new MLClientService();
