import React, { Component } from 'react';
import axios from 'axios';

class NestData extends Component {
  state = {
    values: [],
    loading: true,
    error: null,
  };

  componentDidMount() {
    this.fetchValues();
  }

  async fetchValues() {
    try {
      const response = await axios.get('/api/nest/values');
      this.setState({ values: response.data, loading: false, error: null });
    } catch (error) {
      this.setState({
        error: 'Failed to load data from NestJS API',
        loading: false,
      });
    }
  }

  render() {
    const { values, loading, error } = this.state;

    if (loading) {
      return (
        <div className="page-card">
          <div className="loading-state">
            <div className="spinner" />
            <span>Loading Postgres data from NestJS…</span>
          </div>
        </div>
      );
    }

    if (error) {
      return (
        <div className="page-card">
          <div className="page-header">
            <h1>
              Postgres Records
              <span className="badge">NestJS</span>
            </h1>
          </div>
          <div className="error-state">{error}</div>
        </div>
      );
    }

    return (
      <div className="page-card">
        <div className="page-header">
          <h1>
            Postgres Records
            <span className="badge">NestJS</span>
          </h1>
          <p>
            All rows from the <code>values</code> table, served by the NestJS API
            at <code>/api/nest/values</code>.
          </p>
        </div>

        {!values.length ? (
          <div className="empty-state">
            <div className="empty-state-icon">📭</div>
            <p>No records yet. Submit indexes on the Calculator page first.</p>
          </div>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>#</th>
                <th>Index (number)</th>
              </tr>
            </thead>
            <tbody>
              {values.map((row, index) => (
                <tr key={index}>
                  <td>{index + 1}</td>
                  <td>{row.number}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    );
  }
}

export default NestData;
