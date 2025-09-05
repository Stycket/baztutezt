<script>
  import { session } from '$lib/stores';

  
  const features = [
    {
      icon: '🏢',
      title: 'Custom Backup Solutions',
      description: 'Tailored to your needs'
    },
    {
      icon: '♾️',
      title: 'Unlimited Storage',
      description: 'No storage limits'
    },
    {
      icon: '👤',
      title: 'Dedicated Support',
      description: 'Personal account manager'
    },
    {
      icon: '📊',
      title: 'Enterprise Analytics',
      description: 'Advanced reporting'
    },
    {
      icon: '🔐',
      title: 'Maximum Security',
      description: 'Enterprise-grade protection'
    },
    {
      icon: '🌐',
      title: 'Global CDN',
      description: 'Worldwide fast access'
    }
  ];
</script>

<div class="enterprise-container">
  <div class="max-w-6xl mx-auto px-4 py-8">
    <div class="flex items-center justify-between mb-8">
      <div>
        <h1 class="text-3xl font-bold mb-2">Enterprise Dashboard</h1>
        <p class="text-gray-200">Welcome to your enterprise command center</p>
      </div>
      <div class="plan-badge">Enterprise Plan</div>
    </div>
    
    <div class="grid grid-cols-1 md:grid-cols-3 gap-6">
      {#each features as feature}
        <div class="feature-card">
          <div class="text-4xl mb-4">{feature.icon}</div>
          <h3 class="text-xl font-semibold mb-2">{feature.title}</h3>
          <p>{feature.description}</p>
        </div>
      {/each}
    </div>
  </div>
</div>

<style>
  .enterprise-container {
    background: linear-gradient(135deg, #020617, #1e1b4b);
    min-height: calc(100vh - 64px);
    color: white;
  }
  
  .plan-badge {
    background: #6d28d9;
    color: white;
    padding: 0.5rem 1rem;
    border-radius: 9999px;
    font-weight: 500;
  }
  
  .feature-card {
    background: rgba(255, 255, 255, 0.05);
    backdrop-filter: blur(10px);
    padding: 2rem;
    border-radius: 1rem;
    border: 1px solid rgba(255, 255, 255, 0.1);
    text-align: center;
    transition: transform 0.2s;
  }
  
  .feature-card:hover {
    transform: translateY(-5px);
  }
</style>
