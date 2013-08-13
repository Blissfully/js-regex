
module.exports = function (grunt) {
    'use strict';

    grunt.initConfig({
        qunit: {
            all: 'test/index.html'
        },
        jshint: {
            all: ['**/*.js', '!test/resources/**', '!node_modules/**']
        },
    });

    grunt.registerTask('default', 'jshint');
    //grunt.registerTask('default', ['jshint', 'qunit']);

    //grunt.loadNpmTasks('grunt-contrib-qunit');
    grunt.loadNpmTasks('grunt-contrib-jshint');

};

