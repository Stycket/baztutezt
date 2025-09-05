<script>
  import { session } from '$lib/stores';

  
  const features = [
    {
      icon: '🔄',
      title: 'Advanced Backup',
      description: 'Enhanced backup capabilities'
    },
    {
      icon: '💽',
      title: '50GB Storage',
      description: 'Expanded storage capacity'
    },
    {
      icon: '🎯',
      title: 'Priority Support',
      description: 'Faster response times'
    },
    {
      icon: '📊',
      title: 'Basic Analytics',
      description: 'Track your backup stats'
    }
  ];
</script>

<div class="basic-container">
  <div class="max-w-4xl mx-auto px-4 py-8">
    <div class="flex items-center justify-between mb-8">
      <div>
        <h1 class="text-3xl font-bold mb-2">Basic Plan Dashboard</h1>
        <p class="text-gray-600">Welcome to your enhanced backup solution</p>
      </div>
      <div class="plan-badge">Basic Plan</div>
    </div>
    
    <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
      {#each features as feature}
        <div class="feature-card">
          <div class="text-4xl mb-4">{feature.icon}</div>
          <h3 class="text-xl font-semibold mb-2">{feature.title}</h3>
          <p class="text-gray-600">{feature.description}</p>
        </div>
      {/each}
    </div>
    
    <div class="mt-12 text-center">
      <a href="/subscribe" class="upgrade-button">
        Upgrade to Premium
      </a>
    </div>
  </div>
</div>

<style>
  .basic-container {
    background: linear-gradient(135deg, #e0f2fe, #dbeafe);
    min-height: calc(100vh - 64px);
  }
  
  .plan-badge {
    background: #3b82f6;
    color: white;
    padding: 0.5rem 1rem;
    border-radius: 9999px;
    font-weight: 500;
  }
  
  .feature-card {
    background: white;
    padding: 2rem;
    border-radius: 1rem;
    box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
    text-align: center;
    transition: transform 0.2s;
  }
  
  .feature-card:hover {
    transform: translateY(-5px);
  }
  
  .upgrade-button {
    display: inline-block;
    padding: 0.75rem 1.5rem;
    background: #2563eb;
    color: white;
    border-radius: 0.5rem;
    font-weight: 500;
    transition: all 0.2s;
  }
  
  .upgrade-button:hover {
    background: #1d4ed8;
    transform: scale(1.05);
  }
</style>
