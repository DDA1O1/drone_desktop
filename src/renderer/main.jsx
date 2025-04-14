import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import { Provider } from 'react-redux'
import  store  from '@/store/store' // Adjust the path to your store configuration
import './index.css'

ReactDOM.createRoot(document.getElementById('root')).render(
    <Provider store={store}>
      {/* Your app component */}
      <App />
    </Provider>
  
)
