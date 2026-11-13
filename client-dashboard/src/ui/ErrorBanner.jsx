import React from 'react';
import { AlertTriangleIcon } from './Icons.jsx';

/** Plain-language message for a failed report request; no codes or server details. */
function friendlyMessage(error) {
  if (error.status === 403 || error.status === 404) return 'You do not have access to this store, or it no longer exists.';
  if (error.status === 400) return 'Those dates or filters are not valid. Please check them and try again.';
  if (error.message && !error.status) return error.message;
  return 'Please press Refresh to try again. If it keeps happening, contact support.';
}

export function ErrorBanner({ error, title = 'This report could not be loaded' }) {
  if (!error) return null;
  return (
    <div className="error-banner" role="alert">
      <AlertTriangleIcon size={20} className="error-icon" />
      <div className="error-banner-content">
        <h4>{title}</h4>
        <p>{friendlyMessage(error)}</p>
      </div>
    </div>
  );
}
