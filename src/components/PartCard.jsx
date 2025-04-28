import React, { useState } from 'react';
import './PartCard.css';

function PartCard({ part }) {
  const [showOrderInfo, setShowOrderInfo] = useState(false);
  
  if (!part) return null;
  
  // Format price with commas and two decimal places
  const formattedPrice = parseFloat(part.price).toLocaleString('en-US', {
    style: 'currency',
    currency: 'USD',
  });
  
  // Estimated delivery date (7 days from now)
  const deliveryDate = new Date();
  deliveryDate.setDate(deliveryDate.getDate() + 7);
  const formattedDeliveryDate = deliveryDate.toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric'
  });
  
  return (
    <div className="part-card">
      <div className="part-header">
        <h3>{part.name}</h3>
        <span className="part-id">Part #: {part.id}</span>
      </div>
      <div className="part-content">
        <div className="part-image-container">
          <img 
            src={part.imageUrl || '/placeholder-part.png'} 
            alt={part.name} 
            className="part-image" 
          />
        </div>
        <div className="part-details">
          <div className="part-price-container">
            <div className="part-price">{formattedPrice}</div>
            <div className="part-stock">In Stock</div>
          </div>
          
          <div className="part-specs">
            <div className="spec-item">
              <span className="spec-label">Installation:</span>
              <span className="spec-value">{part.difficulty}</span>
            </div>
            <div className="spec-item">
              <span className="spec-label">Est. Time:</span>
              <span className="spec-value">{part.time}</span>
            </div>
            {part.brand && (
              <div className="spec-item">
                <span className="spec-label">Brand:</span>
                <span className="spec-value">{part.brand}</span>
              </div>
            )}
          </div>
          
          <div className="transaction-actions">
            {/* Main transaction buttons */}
            <a 
              href={part.productUrl} 
              className="transaction-button primary" 
              target="_blank" 
              rel="noopener noreferrer"
            >
              Buy Now
            </a>
            <button 
              className="transaction-button secondary"
              onClick={() => setShowOrderInfo(!showOrderInfo)}
            >
              {showOrderInfo ? 'Hide Details' : 'Shipping & Returns'}
            </button>
          </div>
          
          {/* Order information collapsible section */}
          {showOrderInfo && (
            <div className="order-info">
              <div className="order-info-item">
                <span className="order-info-label">Estimated Delivery:</span>
                <span className="order-info-value">{formattedDeliveryDate}</span>
              </div>
              <div className="order-info-item">
                <span className="order-info-label">Free Shipping:</span>
                <span className="order-info-value">On orders over $50</span>
              </div>
              <div className="order-info-item">
                <span className="order-info-label">Returns:</span>
                <span className="order-info-value">90-day hassle-free returns</span>
              </div>
              <div className="order-info-item">
                <span className="order-info-label">Warranty:</span>
                <span className="order-info-value">1-year manufacturer warranty</span>
              </div>
            </div>
          )}
          
          <div className="part-actions">
            {/* Additional information links */}
            {part.productUrl && (
              <a 
                href={part.productUrl} 
                className="part-button outline" 
                target="_blank" 
                rel="noopener noreferrer"
              >
                View Full Details
              </a>
            )}
            {part.videoUrl && (
              <a 
                href={part.videoUrl} 
                className="part-button outline" 
                target="_blank" 
                rel="noopener noreferrer"
              >
                Watch Installation Video
              </a>
            )}
            {part.compatibilityUrl && (
              <a 
                href={part.compatibilityUrl} 
                className="part-button outline" 
                target="_blank" 
                rel="noopener noreferrer"
              >
                Check Compatibility
              </a>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default PartCard;