(async function () {

    ///////// INSERT YOUR KEY & EVENT NAME BELOW /////////
    const iftttKey = "paste_here_your_ifttt_key"
    const iftttEventName = "paste_here_your_event_name"
    //////////////////////////////////////////////////////

    const recheckIntervalInMs = 60000 + (Math.round(Math.random() * 20 - 10) * 1000);

    const captchaWasVisibleBefore = (await chrome.storage.local.get("captchaIsVisible")).captchaIsVisible;
    const captchaIsVisible = !!document.querySelector('.main__captcha');

    if (captchaIsVisible && !captchaWasVisibleBefore) {
        await sendMessage("Solve the Captcha! ❌", null, null);
        await chrome.storage.local.set({ "captchaIsVisible": true });
    }

    if (!captchaIsVisible) {

        if (captchaWasVisibleBefore) {
            await sendMessage("Captcha solved! ✅", null, null);
        }

        // 👇 Process ALL pages
        await checkAllPages();

        await chrome.storage.local.set({ "captchaIsVisible": false });

        // after finishing the last page
        const firstPageBtn = document.querySelector('button[data-testid="pagination-button"][page="1"]');
        if (firstPageBtn) {
            console.log("Going back to page 1...");
            firstPageBtn.click();
            console.log(`Reloading first page after ${Math.round(recheckIntervalInMs / 1000)}s...`);

            // wait ~60s before reloading
            setTimeout(() => {
                location.reload();
            }, recheckIntervalInMs);

        } else {
            // fallback: just reload site after interval
            console.log(`Page 1 button not found, reloading directly after ${Math.round(recheckIntervalInMs / 1000)}s...`);
            setTimeout(() => {
                location.reload();
            }, recheckIntervalInMs);
        }

    }

    // ------------------- FUNCTIONS -------------------

    async function checkAllPages() {
        while (true) {
            await triggerLazyLoading();

            // Select all listings on the current page
            const items = [...document.querySelectorAll("div.listing-card[class*='card-listing-']")];
            console.log("Found listings on page:", items.length);

            const previousIds = (await chrome.storage.local.get("immoIds")).immoIds || [];
            const currentIds = items.map(item => item.getAttribute("data-obid"));
            const newIds = currentIds.filter(id => !previousIds.includes(id));

            if (previousIds.length === 0) {
                console.log("Immo Check: Initial items were saved successfully");
                await sendMessage("Immo Check setup was successful! ✅", null, null);
            } else if (newIds.length === 0) {
                console.log("Immo Check: No new items found on this page.");
            } else {
                console.log("Immo Check: Found " + newIds.length + " new items");

                for (const id of newIds) {
                    const element = document.querySelector(`div.listing-card[data-obid="${id}"]`);
                    if (!element) continue;

                    // ---------- Title ----------
                    const textElem = element.querySelector("h2[data-testid='headline']");
                    let text = textElem ? textElem.innerText.trim() : "No title";
                    text = text.replace(/^Neu\s*/i, "").trim();

                    // ---------- URL ----------
                    const linkElem = element.querySelector("a[href*='/expose/']");
                    const link = linkElem
                        ? new URL(linkElem.getAttribute("href"), window.location.origin).href
                        : null;

                    // ---------- Image ----------
                    let imgElem = element.querySelector("img.gallery__image");

                    if (!imgElem) {
                        const candidates = [...element.querySelectorAll("img")];
                        imgElem = candidates.find(img =>
                            !/logo/i.test(img.alt || "") && !/logo/i.test(img.src || "")
                        ) || null;
                    }

                    let image = null;
                    if (imgElem) {
                        image = imgElem.src;
                    } else {
                        const bgDiv = element.querySelector("[style*='background-image']");
                        if (bgDiv) {
                            const match = bgDiv.style.backgroundImage.match(/url\(["']?(.*?)["']?\)/);
                            if (match) image = match[1];
                        }
                    }

                    // ---------- Send ----------
                    await sendMessage(text, link, image);
                }
            }

            // Save seen IDs (merge with old ones across pages)
            const allSeen = [...new Set([...previousIds, ...currentIds])];
            await chrome.storage.local.set({ "immoIds": allSeen });

            // 🔄 Check if "next page" exists
            const nextPageBtn = document.querySelector('button[data-testid="pagination-button-next"]');
            if (!nextPageBtn || nextPageBtn.disabled || nextPageBtn.getAttribute("aria-disabled") === "true") {
                console.log("Reached last page.");
                break; // stop loop
            }

            console.log("Going to next page...");
            nextPageBtn.click();
            await wait(4000); // wait for next page to load
        }
    }

    function sendMessage(text, link, image) {
        const url = `https://maker.ifttt.com/trigger/${iftttEventName}/with/key/${iftttKey}?value1=${encodeURIComponent(text)}&value2=${encodeURIComponent(link)}&value3=${encodeURIComponent(image)}`;
        return fetch(url, { mode: "no-cors" });
    }

    async function wait(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    async function triggerLazyLoading() {
        scrollDown();
        await wait(3000); // wait 3 seconds for images to load
        scrollUp();
    }

    function scrollUp() {
        window.scrollTo({ top: 0, behavior: 'smooth' });
    }

    function scrollDown() {
        const body = document.body,
            html = document.documentElement;
        const height = Math.max(body.scrollHeight, body.offsetHeight,
            html.clientHeight, html.scrollHeight, html.offsetHeight);
        window.scrollTo({ top: height, behavior: 'smooth' });
    }

})();
