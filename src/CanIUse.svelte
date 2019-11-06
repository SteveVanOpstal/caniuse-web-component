<script>
  import { onMount } from "svelte";
  export let type;
  export let browsers;
  export let combine = true;
   // when combine is `true` usage percentage of mobile and desktop browsers will be combined
   // i.e. chrome and and_chr

  let hovering = false;
  let entries = [];
  let remaining_count = 0;
  let remaining_usage = 0;

  function browserExists(agents, browserId) {
    return !!agents[browserId];
  }

  function browserDisplayName(agents, browserId) {
    return agents[browserId].browser;
  }

  function browserCurrentVersion(agents, browserId) {
    return agents[browserId].current_version;
  }

  function browserVersionRange(agents, browserId, stats) {
    const current = browserCurrentVersion(agents, browserId);
    const currentVersionStatValue = statToValue(stats[browserId][current]);
    const allVersions = agents[browserId].version_list;

    let oldest = allVersions[allVersions.length - 1].version;
    for (let index = allVersions.length - 1; index >= 0; index--) {
      const version = allVersions[index];
      const statValue = statToValue(stats[browserId][version.version]);
      if(statValue !== currentVersionStatValue) {
        oldest = allVersions[index-1].version;
        break;
      }
    }


    if(!oldest || current === oldest) {
      return current;
    }
    return `${oldest}-${current}`;
  }

  function _browserUsage(agents, browserId, stats, version) {
    const allVersions = agents[browserId].usage_global;
    let currentVersionStatValue;
    if(stats && version) {
      currentVersionStatValue = statToValue(stats[browserId][version]);
    }
    return Object.entries(allVersions).reduce((a, b) => {
        if(currentVersionStatValue) {
          const statValue = statToValue(stats[browserId][b[0]]);
          if(currentVersionStatValue === statValue) {
            return a + b[1];
          }
        } else {
          return a + b[1];
        }
        return a;
      }, 0);
  }

  function _mapDesktopToMobile(desktopBrowserId) {
    switch(desktopBrowserId) {
      case 'chrome':
        return ['and_chr'];
      case 'firefox':
        return ['and_ff'];
      case 'ie':
        return ['ie_mob'];
      case 'safari':
        return ['ios_saf'];
      case 'opera':
        return ['op_mini', 'op_mob'];
        default:
          return [];
    }
  }

  function browserUsage(agents, browserId, stats, version) {
    let total = 0;
    if(combine) {
      const mobileBrowserIds = _mapDesktopToMobile(browserId);
      for(const mobileBrowserId of mobileBrowserIds) {
        const mobileBrowserVersion = browserCurrentVersion(agents, mobileBrowserId);
        total += _browserUsage(agents, mobileBrowserId, stats, mobileBrowserVersion);
      }
    }
    total += _browserUsage(agents, browserId, stats, version);
    return total;
  }

  function statToValue(stat) {
    switch (stat[0]) {
      case "y":
        return 2;
      case "n":
        return 0;
      default:
        return 1;
    }
  }

  onMount(async () => {
    const response = await fetch(
      "https://raw.githubusercontent.com/Fyrd/caniuse/master/fulldata-json/data-2.0.json"
    );
    const json = await response.json();
    const data = json.data;
    const agents = json.agents;

    combine = combine === 'false' ? false : true;

    const typeData = data[type];
    if (!typeData) {
      return;
    }

    const stats = typeData.stats;

    let browserIds = [];
    if (!browsers || !browsers.length) {
      browserIds = Object.keys(agents);
    } else {
      try {
        browserIds = JSON.parse(browsers.replace(/'/g, '"'));
      } catch(_e) {
        console.error('incorrect \'browsers\' format. Example: browsers="[\'firefox\', \'chrome\']".');
      }
    }

    entries = [];
    if (browserIds && browserIds.length) {
      for (const browserId of browserIds) {
        if (!browserExists(agents, browserId)) {
          continue;
        }
        const version = browserCurrentVersion(agents, browserId);
        const range = browserVersionRange(agents, browserId, stats);
        const name = browserDisplayName(agents, browserId);
        const usage = browserUsage(agents, browserId, stats, version);
        const stat = stats[browserId][version];
        entries.push({ name, range, stat, usage });
      }
    }

    entries = entries.sort((entryA, entryB) => {
      const valueA = statToValue(entryA.stat);
      const valueB = statToValue(entryB.stat);
      if (valueA === valueB) {
        return entryA.usage < entryB.usage ? 1 : -1;
      }
      return valueA < valueB ? 1 : -1;
    });

    let currentlyUsedBrowserIds = browserIds;
    if (combine) {
      for(const browserId of browserIds) {
        currentlyUsedBrowserIds =currentlyUsedBrowserIds.concat(_mapDesktopToMobile(browserId));
      }
    } 

    remaining_count = Object.keys(agents).length - currentlyUsedBrowserIds.length;

    const remainingBrowsers = Object.keys(agents).filter(
      a => currentlyUsedBrowserIds.indexOf(a) < 0
    );
    remaining_usage = 0;
    for (const browserId of remainingBrowsers) {
      remaining_usage += browserUsage(agents, browserId);
    }
  });
</script>

<style>
  .stats {
    display: flex;
    flex-wrap: wrap;
  }

  .stat {
    display: flex;
    justify-content: center;
    align-items: center;
    color: white;
    background-color: #a8bd04;
    line-height: 1em;
    margin: 0.25em;
    padding: 0.5em;
    border-radius: 10px;
    white-space: nowrap;
    min-width: 3em;
  }

  .stat.y {
    background-color: #39b54a;
  }

  .stat.n {
    background-color: #c44230;
  }

  .stat.gray {
    background-color: gray;
  }

  .stat .hovering {
    color: transparent;
    text-shadow: none;
  }

  .stat .usage {
    position: absolute;
    margin: 0rem;
  }

  .stat p {
    margin: 0;
  }
</style>

<svelte:options tag={null} />
<div
  class="stats"
  on:mouseenter={() => (hovering = true)}
  on:mouseleave={() => (hovering = false)}>
  {#each entries as entry}
    <div class="stat {entry.stat}">
      <p class={hovering ? 'hovering' : ''}>{entry.name} {entry.range}</p>
      {#if hovering}
        <p class="usage">{Math.round(entry.usage * 100) / 100}%</p>
      {/if}
    </div>
  {/each}
  {#if remaining_count}
    <div class="stat gray">
      <p class={hovering ? 'hovering' : ''}>+{remaining_count}</p>
      {#if hovering}
        <p class="usage">{Math.round(remaining_usage * 100) / 100}%</p>
      {/if}
    </div>
  {/if}
</div>
