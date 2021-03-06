YUI.add('moodle-core-chooserdialogue', function(Y) {

    var CHOOSERDIALOGUE = function() {
        CHOOSERDIALOGUE.superclass.constructor.apply(this, arguments);
    };

    Y.extend(CHOOSERDIALOGUE, Y.Base, {
        // The panel widget
        panel: null,

        // The submit button - we disable this until an element is set
        submitbutton : null,

        // The chooserdialogue container
        container : null,

        // Any event listeners we may need to cancel later
        listenevents : [],

        // The initial overflow setting
        initialoverflow : '',

        bodycontent : null,
        headercontent : null,
        instanceconfig : null,

        setup_chooser_dialogue : function(bodycontent, headercontent, config) {
            this.bodycontent = bodycontent;
            this.headercontent = headercontent;
            this.instanceconfig = config;
        },

        prepare_chooser : function () {
            if (this.panel) {
                return;
            }

            // Set Default options
            var paramkey,
                params = {
                bodyContent : this.bodycontent.get('innerHTML'),
                headerContent : this.headercontent.get('innerHTML'),
                width : '540px',
                draggable : true,
                visible : false, // Hide by default
                zindex : 100, // Display in front of other items
                lightbox : true, // This dialogue should be modal
                shim : true,
                closeButtonTitle : this.get('closeButtonTitle')
            };

            // Override with additional options
            for (paramkey in this.instanceconfig) {
              params[paramkey] = this.instanceconfig[paramkey];
            }

            // Create the panel
            this.panel = new M.core.dialogue(params);

            // Remove the template for the chooser
            this.bodycontent.remove();
            this.headercontent.remove();

            // Hide and then render the panel
            this.panel.hide();
            this.panel.render();

            // Set useful links
            this.container = this.panel.get('boundingBox').one('.choosercontainer');
            this.options = this.container.all('.option input[type=radio]');

            // Add the chooserdialogue class to the container for styling
            this.panel.get('boundingBox').addClass('chooserdialogue');
        },

        /**
         * Display the module chooser
         *
         * @param e Event Triggering Event
         * @return void
         */
        display_chooser : function (e) {
            var bb, dialogue, thisevent;
            this.prepare_chooser();

            // Stop the default event actions before we proceed
            e.preventDefault();

            bb = this.panel.get('boundingBox');
            dialogue = this.container.one('.alloptions');

            // Get the overflow setting when the chooser was opened - we
            // may need this later
            if (Y.UA.ie > 0) {
                this.initialoverflow = Y.one('html').getStyle('overflow');
            } else {
                this.initialoverflow = Y.one('body').getStyle('overflow');
            }

            // This will detect a change in orientation and retrigger centering
            thisevent = Y.one('document').on('orientationchange', function() {
                this.center_dialogue(dialogue);
            }, this);
            this.listenevents.push(thisevent);

            // Detect window resizes (most browsers)
            thisevent = Y.one('window').on('resize', function() {
                this.center_dialogue(dialogue);
            }, this);
            this.listenevents.push(thisevent);

            // These will trigger a check_options call to display the correct help
            thisevent = this.container.on('click', this.check_options, this);
            this.listenevents.push(thisevent);
            thisevent = this.container.on('key_up', this.check_options, this);
            this.listenevents.push(thisevent);
            thisevent = this.container.on('dblclick', function(e) {
                if (e.target.ancestor('div.option')) {
                    this.check_options();

                    // Prevent duplicate submissions
                    this.submitbutton.setAttribute('disabled', 'disabled');
                    this.options.setAttribute('disabled', 'disabled');
                    this.cancel_listenevents();

                    this.container.one('form').submit();
                }
            }, this);
            this.listenevents.push(thisevent);

            this.container.one('form').on('submit', function() {
                // Prevent duplicate submissions on submit
                this.submitbutton.setAttribute('disabled', 'disabled');
                this.options.setAttribute('disabled', 'disabled');
                this.cancel_listenevents();
            }, this);

            // Hook onto the cancel button to hide the form
            thisevent = this.container.one('.addcancel').on('click', this.cancel_popup, this);
            this.listenevents.push(thisevent);

            // Hide will be managed by cancel_popup after restoring the body overflow
            thisevent = bb.one('button.closebutton').on('click', this.cancel_popup, this);
            this.listenevents.push(thisevent);

            // Grab global keyup events and handle them
            thisevent = Y.one('document').on('keyup', this.handle_key_press, this);
            this.listenevents.push(thisevent);

            // Add references to various elements we adjust
            this.jumplink     = this.container.one('.jump');
            this.submitbutton = this.container.one('.submitbutton');

            // Disable the submit element until the user makes a selection
            this.submitbutton.set('disabled', 'true');

            // Ensure that the options are shown
            this.options.removeAttribute('disabled');

            // Display the panel
            this.panel.show();

            // Re-centre the dialogue after we've shown it.
            this.center_dialogue(dialogue);

            // Finally, focus the first radio element - this enables form selection via the keyboard
            this.container.one('.option input[type=radio]').focus();

            // Trigger check_options to set the initial jumpurl
            this.check_options();
        },

        /**
         * Cancel any listen events in the listenevents queue
         *
         * Several locations add event handlers which should only be called before the form is submitted. This provides
         * a way of cancelling those events.
         *
         * @return void
         */
        cancel_listenevents : function () {
            // Detach all listen events to prevent duplicate triggers
            var thisevent;
            while (this.listenevents.length) {
                thisevent = this.listenevents.shift();
                thisevent.detach();
            }
        },

        /**
         * Calculate the optimum height of the chooser dialogue
         *
         * This tries to set a sensible maximum and minimum to ensure that some options are always shown, and preferably
         * all, whilst fitting the box within the current viewport.
         *
         * @param dialogue Y.Node The dialogue
         * @return void
         */
        center_dialogue : function(dialogue) {
            var bb = this.panel.get('boundingBox'),
                winheight = bb.get('winHeight'),
                winwidth = bb.get('winWidth'),
                offsettop = 0,
                newheight, totalheight, dialoguetop, dialoguewidth, dialogueleft;

            // Try and set a sensible max-height -- this must be done before setting the top
            // Set a default height of 640px
            newheight = this.get('maxheight');
            if (winheight <= newheight) {
                // Deal with smaller window sizes
                if (winheight <= this.get('minheight')) {
                    newheight = this.get('minheight');
                } else {
                    newheight = winheight;
                }
            }

            // Set a fixed position if the window is large enough
            if (newheight > this.get('minheight')) {
                bb.setStyle('position', 'fixed');
                // Disable the page scrollbars
                if (Y.UA.ie > 0) {
                    Y.one('html').setStyle('overflow', 'hidden');
                } else {
                    Y.one('body').setStyle('overflow', 'hidden');
                }
            } else {
                bb.setStyle('position', 'absolute');
                offsettop = Y.one('window').get('scrollTop');
                // Ensure that the page scrollbars are enabled
                if (Y.UA.ie > 0) {
                    Y.one('html').setStyle('overflow', this.initialoverflow);
                } else {
                    Y.one('body').setStyle('overflow', this.initialoverflow);
                }
            }

            // Take off 15px top and bottom for borders, plus 40px each for the title and button area before setting the
            // new max-height
            totalheight = newheight;
            newheight = newheight - (15 + 15 + 40 + 40);
            dialogue.setStyle('max-height', newheight + 'px');
            dialogue.setStyle('height', newheight + 'px');

            // Re-calculate the location now that we've changed the size
            dialoguetop = Math.max(12, ((winheight - totalheight) / 2)) + offsettop;

            // We need to set the height for the yui3-widget - can't work
            // out what we're setting at present -- shoud be the boudingBox
            bb.setStyle('top', dialoguetop + 'px');

            // Calculate the left location of the chooser
            // We don't set a minimum width in the same way as we do height as the width would be far lower than the
            // optimal width for moodle anyway.
            dialoguewidth = bb.get('offsetWidth');
            dialogueleft = (winwidth - dialoguewidth) / 2;
            bb.setStyle('left', dialogueleft + 'px');
        },

        handle_key_press : function(e) {
            if (e.keyCode === 27) {
                this.cancel_popup(e);
            }
        },

        cancel_popup : function (e) {
            // Prevent normal form submission before hiding
            e.preventDefault();
            this.hide();
        },

        hide : function() {
            // Cancel all listen events
            this.cancel_listenevents();

            // Re-enable the page scrollbars
            if (Y.UA.ie > 0) {
                Y.one('html').setStyle('overflow', this.initialoverflow);
            } else {
                Y.one('body').setStyle('overflow', this.initialoverflow);
            }

            this.container.detachAll();
            this.panel.hide();
        },

        check_options : function() {
            // Check which options are set, and change the parent class
            // to show/hide help as required
            this.options.each(function(thisoption) {
                var optiondiv = thisoption.get('parentNode').get('parentNode');
                if (thisoption.get('checked')) {
                    optiondiv.addClass('selected');

                    // Trigger any events for this option
                    this.option_selected(thisoption);

                    // Ensure that the form may be submitted
                    this.submitbutton.removeAttribute('disabled');

                    // Ensure that the radio remains focus so that keyboard navigation is still possible
                    thisoption.focus();
                } else {
                    optiondiv.removeClass('selected');
                }
            }, this);
        },

        option_selected : function() {
        }
    },
    {
        NAME : 'moodle-core-chooserdialogue',
        ATTRS : {
            minheight : {
                value : 300
            },
            maxheight : {
                value : 660
            },
            closeButtonTitle : {
                validator : Y.Lang.isString,
                value : 'Close'
            }
        }
    });
    M.core = M.core || {};
    M.core.chooserdialogue = CHOOSERDIALOGUE;
},
'@VERSION@', {
    requires:['base', 'panel', 'moodle-core-notification']
}
);
